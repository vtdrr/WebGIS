import { pool } from '../../src/db/pool.js';
import { invalidateGraphCache } from '../../src/modules/routing/routing.service.js';

export interface PlaceFixture {
  code?: string;
  name_vi: string;
  name_en?: string;
  description_vi?: string;
  description_en?: string;
  category?: string; // category code, default 'building'
  lng?: number;
  lat?: number;
  floor?: number;
}

/** Remove all places and paths (categories are kept). */
export async function resetData(): Promise<void> {
  await pool.query('TRUNCATE places, campus_paths RESTART IDENTITY CASCADE');
  invalidateGraphCache();
}

export async function insertPlace(p: PlaceFixture): Promise<string> {
  const hasPoint = p.lng !== undefined && p.lat !== undefined;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO places (category_id, code, name_vi, name_en, description_vi, description_en, floor, geom_point)
     VALUES (
       (SELECT id FROM categories WHERE code = $1),
       $2, $3, $4, $5, $6, $7,
       CASE WHEN $8::boolean THEN ST_SetSRID(ST_MakePoint($9, $10), 4326) END
     )
     RETURNING id`,
    [
      p.category ?? 'building',
      p.code ?? null,
      p.name_vi,
      p.name_en ?? null,
      p.description_vi ?? null,
      p.description_en ?? null,
      p.floor ?? null,
      hasPoint,
      p.lng ?? null,
      p.lat ?? null,
    ],
  );
  return res.rows[0].id;
}

/** Insert an undirected path between two places (by code), straight line, geodesic length. */
export async function insertPath(source: string, target: string, name = 'Đường test'): Promise<void> {
  await pool.query(
    `INSERT INTO campus_paths (source_code, target_code, distance_m, path_name, geom)
     SELECT $1::varchar, $2::varchar, ST_Distance(a.geom_point::geography, b.geom_point::geography), $3::varchar,
            ST_MakeLine(a.geom_point, b.geom_point)
     FROM places a, places b WHERE a.code = $1 AND b.code = $2`,
    [source, target, name],
  );
  invalidateGraphCache();
}
