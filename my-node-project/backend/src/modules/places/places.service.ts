import { query, getClient } from '../../db/pool.js';
import type { CreatePlace, UpdatePlace, PlaceQuery, PlaceResponse, PlaceListResponse } from '../common/schemas.js';

/** Error with HTTP status, handled by the global error handler */
function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

/** Validate & normalize a GeoJSON Point coordinate pair to [lng, lat] */
function normalizePoint(point: CreatePlace['geom_point']): [number, number] {
  const coords = Array.isArray(point) ? point : point?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw badRequest('geom_point must be a [lng, lat] pair or GeoJSON Point');
  }
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw badRequest('geom_point coordinates must be finite numbers');
  }
  return [lng, lat];
}

/** Validate GeoJSON Polygon rings and build WKT (auto-closes open rings) */
function polygonToWKT(coordinates: unknown): string {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw badRequest('geom_polygon.coordinates must be a non-empty array of rings');
  }
  const wktRings = coordinates.map((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) {
      throw badRequest('Each polygon ring needs at least 4 positions');
    }
    const points = ring.map((p) => {
      if (!Array.isArray(p) || p.length < 2) {
        throw badRequest('Each polygon position must be a [lng, lat] pair');
      }
      const [lng, lat] = p;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw badRequest('Polygon coordinates must be finite numbers');
      }
      return `${lng} ${lat}`;
    });
    // Auto-close the ring if it is not closed
    if (points[0] !== points[points.length - 1]) points.push(points[0]);
    return `(${points.join(',')})`;
  });
  return `POLYGON(${wktRings.join(',')})`;
}

export class PlacesService {
  private readonly SELECT_FIELDS = `
    p.id, p.category_id, p.code, p.name_vi, p.name_en,
    p.description_vi, p.description_en,
    ST_AsGeoJSON(p.geom_point)::json as geom_point,
    ST_AsGeoJSON(p.geom_polygon)::json as geom_polygon,
    p.floor, p.opening_hours, p.contact_phone, p.contact_email,
    p.images, p.attributes,
    p.created_at, p.updated_at,
    c.code as category_code, c.name_vi as category_name_vi,
    c.name_en as category_name_en, c.icon as category_icon, c.color as category_color
  `;

  private readonly FROM_CLAUSE = `
    FROM places p
    LEFT JOIN categories c ON p.category_id = c.id
  `;

  async findAll(params: PlaceQuery): Promise<PlaceListResponse> {
    const { page, limit, category, q, bbox, floor, has_polygon, sort, order } = params;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`c.code = $${paramIndex++}`);
      values.push(category);
    }

    if (q) {
      conditions.push(`p.search_tsv @@ plainto_tsquery('simple', $${paramIndex++})`);
      values.push(q);
    }

    if (bbox) {
      const parts = bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
        throw badRequest('bbox must be "minLng,minLat,maxLng,maxLat" with numeric values');
      }
      const [minLng, minLat, maxLng, maxLat] = parts;
      conditions.push(`
        (p.geom_point && ST_MakeEnvelope($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, 4326)
         OR p.geom_polygon && ST_MakeEnvelope($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, 4326))
      `);
      values.push(minLng, minLat, maxLng, maxLat);
      paramIndex += 4;
    }

    if (floor !== undefined) {
      conditions.push(`p.floor = $${paramIndex++}`);
      values.push(floor);
    }

    if (has_polygon !== undefined) {
      conditions.push(has_polygon ? 'p.geom_polygon IS NOT NULL' : 'p.geom_polygon IS NULL');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['name_vi', 'code', 'created_at', 'updated_at', 'category_name_vi'];
    const sortColumn = allowedSortColumns.includes(sort) ? sort : 'name_vi';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    // Count total
    const countResult = await query<{ count: string }>(`
      SELECT COUNT(*)::text as count
      ${this.FROM_CLAUSE}
      ${whereClause}
    `, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get data
    const dataResult = await query<PlaceResponse>(`
      SELECT ${this.SELECT_FIELDS}
      ${this.FROM_CLAUSE}
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...values, limit, offset]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult.rows,
      meta: { page, limit, total, totalPages },
      links: {
        self: `/api/places?page=${page}&limit=${limit}`,
        next: page < totalPages ? `/api/places?page=${page + 1}&limit=${limit}` : null,
        prev: page > 1 ? `/api/places?page=${page - 1}&limit=${limit}` : null,
      },
    };
  }

  async findById(id: string): Promise<PlaceResponse | null> {
    const result = await query<PlaceResponse>(`
      SELECT ${this.SELECT_FIELDS}
      ${this.FROM_CLAUSE}
      WHERE p.id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findByCode(code: string): Promise<PlaceResponse | null> {
    const result = await query<PlaceResponse>(`
      SELECT ${this.SELECT_FIELDS}
      ${this.FROM_CLAUSE}
      WHERE p.code = $1
    `, [code]);
    return result.rows[0] ?? null;
  }

  async findNearby(lat: number, lng: number, radius: number, limit: number, category?: string): Promise<PlaceResponse[]> {
    let sql = `
      SELECT ${this.SELECT_FIELDS},
             ST_Distance(p.geom_point::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_m
      ${this.FROM_CLAUSE}
      WHERE p.geom_point IS NOT NULL
        AND ST_DWithin(p.geom_point::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    `;
    const values: any[] = [lng, lat, radius];

    if (category) {
      sql += ` AND c.code = $4`;
      values.push(category);
    }

    sql += ` ORDER BY distance_m ASC LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await query<PlaceResponse & { distance_m: number }>(sql, values);
    return result.rows;
  }

  async searchFullText(searchQuery: string, limit: number, category?: string): Promise<Array<PlaceResponse & { rank: number }>> {
    let sql = `
      SELECT ${this.SELECT_FIELDS},
             ts_rank_cd(p.search_tsv, plainto_tsquery('simple', $1)) as rank
      ${this.FROM_CLAUSE}
      WHERE p.search_tsv @@ plainto_tsquery('simple', $1)
    `;
    const values: any[] = [searchQuery];

    if (category) {
      sql += ` AND c.code = $2`;
      values.push(category);
    }

    sql += ` ORDER BY rank DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await query<PlaceResponse & { rank: number }>(sql, values);
    return result.rows;
  }

  async searchFuzzy(searchQuery: string, limit: number): Promise<Array<PlaceResponse & { similarity: number }>> {
    const result = await query<PlaceResponse & { similarity: number }>(`
      SELECT ${this.SELECT_FIELDS},
             similarity(p.name_vi, $1) as similarity
      ${this.FROM_CLAUSE}
      WHERE p.name_vi % $1
      ORDER BY similarity DESC
      LIMIT $2
    `, [searchQuery, limit]);
    return result.rows;
  }

  async create(data: CreatePlace): Promise<PlaceResponse> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Convert GeoJSON to PostGIS
      let geomPointSql = 'NULL';
      let geomPolygonSql = 'NULL';
      const values: any[] = [
        data.category_id,
        data.code,
        data.name_vi,
        data.name_en,
        data.description_vi,
        data.description_en,
        data.floor,
        JSON.stringify(data.opening_hours),
        data.contact_phone,
        data.contact_email,
        JSON.stringify(data.images),
        JSON.stringify(data.attributes),
      ];

      if (data.geom_point) {
        const [lng, lat] = normalizePoint(data.geom_point);
        geomPointSql = `ST_SetSRID(ST_MakePoint($${values.length + 1}, $${values.length + 2}), 4326)`;
        values.push(lng, lat);
      }

      if (data.geom_polygon) {
        const wkt = polygonToWKT(data.geom_polygon.coordinates);
        geomPolygonSql = `ST_GeomFromText($${values.length + 1}, 4326)`;
        values.push(wkt);
      }

      // PostgreSQL's main query cannot see table changes made by a data-modifying
      // CTE, so we SELECT directly FROM the CTE and join categories there
      const result = await client.query<PlaceResponse>(`
        WITH new_place AS (
          INSERT INTO places (
            category_id, code, name_vi, name_en, description_vi, description_en,
            geom_point, geom_polygon, floor, opening_hours, contact_phone, contact_email,
            images, attributes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, ${geomPointSql}, ${geomPolygonSql},
            $7, COALESCE($8, 'null'::jsonb), $9, $10,
            COALESCE($11, '[]'::jsonb), COALESCE($12, '{}'::jsonb)
          )
          RETURNING id, category_id, code, name_vi, name_en, description_vi, description_en,
            geom_point, geom_polygon, floor, opening_hours, contact_phone, contact_email,
            images, attributes, created_at, updated_at
        )
        SELECT
          np.id, np.category_id, np.code, np.name_vi, np.name_en,
          np.description_vi, np.description_en,
          ST_AsGeoJSON(np.geom_point)::json as geom_point,
          ST_AsGeoJSON(np.geom_polygon)::json as geom_polygon,
          np.floor, np.opening_hours,
          np.contact_phone, np.contact_email, np.images, np.attributes,
          np.created_at, np.updated_at,
          c.code as category_code, c.name_vi as category_name_vi,
          c.name_en as category_name_en, c.icon as category_icon, c.color as category_color
        FROM new_place np
        LEFT JOIN categories c ON np.category_id = c.id
      `, values);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(id: string, data: UpdatePlace): Promise<PlaceResponse | null> {
    // Build the field list first — no transaction is needed for validation
    // or for a no-op update, so we never leave an open transaction behind.
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      category_id: 'category_id',
      code: 'code',
      name_vi: 'name_vi',
      name_en: 'name_en',
      description_vi: 'description_vi',
      description_en: 'description_en',
      floor: 'floor',
      opening_hours: 'opening_hours',
      contact_phone: 'contact_phone',
      contact_email: 'contact_email',
      images: 'images',
      attributes: 'attributes',
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key in fieldMap) {
        fields.push(`${fieldMap[key]} = $${paramIndex++}`);
        if (key === 'opening_hours' || key === 'images' || key === 'attributes') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    // Handle geometry updates separately
    if (data.geom_point) {
      const [lng, lat] = normalizePoint(data.geom_point);
      fields.push(`geom_point = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)`);
      values.push(lng, lat);
      paramIndex += 2;
    }

    if (data.geom_polygon) {
      const wkt = polygonToWKT(data.geom_polygon.coordinates);
      fields.push(`geom_polygon = ST_GeomFromText($${paramIndex}, 4326)`);
      values.push(wkt);
      paramIndex++;
    }

    // Nothing to update — skip the transaction entirely
    if (fields.length === 0) return this.findById(id);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      values.push(id);
      // PostgreSQL's main query cannot see table changes made by a data-modifying
      // CTE, so we SELECT directly FROM the CTE and join categories there
      const result = await client.query<PlaceResponse>(`
        WITH updated_place AS (
          UPDATE places SET ${fields.join(', ')}, updated_at = now()
          WHERE id = $${paramIndex}
          RETURNING id, category_id, code, name_vi, name_en, description_vi, description_en,
            geom_point, geom_polygon, floor, opening_hours, contact_phone, contact_email,
            images, attributes, created_at, updated_at
        )
        SELECT
          up.id, up.category_id, up.code, up.name_vi, up.name_en,
          up.description_vi, up.description_en,
          ST_AsGeoJSON(up.geom_point)::json as geom_point,
          ST_AsGeoJSON(up.geom_polygon)::json as geom_polygon,
          up.floor, up.opening_hours,
          up.contact_phone, up.contact_email, up.images, up.attributes,
          up.created_at, up.updated_at,
          c.code as category_code, c.name_vi as category_name_vi,
          c.name_en as category_name_en, c.icon as category_icon, c.color as category_color
        FROM updated_place up
        LEFT JOIN categories c ON up.category_id = c.id
      `, values);

      await client.query('COMMIT');
      return result.rows[0] ?? null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM places WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getGeoJSON(category?: string): Promise<any> {
    let sql = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'geometry', ST_AsGeoJSON(COALESCE(geom_polygon, geom_point))::jsonb,
            'properties', jsonb_build_object(
              'code', code,
              'name_vi', name_vi,
              'name_en', name_en,
              'category_code', category_code,
              'category_name_vi', category_name_vi,
              'category_color', category_color,
              'floor', floor,
              'opening_hours', opening_hours
            )
          )
        ), '[]'::jsonb)
      ) as geojson
      FROM v_places_with_category
      WHERE geom_point IS NOT NULL OR geom_polygon IS NOT NULL
    `;
    const values: any[] = [];

    if (category) {
      sql += ` AND category_code = $1`;
      values.push(category);
    }

    const result = await query<{ geojson: any }>(sql, values);
    return result.rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] };
  }
}

export const placesService = new PlacesService();