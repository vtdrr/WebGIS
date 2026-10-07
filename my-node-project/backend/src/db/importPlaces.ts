import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type pg from 'pg';
import { pool } from './pool.js';

/** One place to import. Category is referenced by its code (e.g. "building"). */
export interface PlaceImportRow {
  code: string;
  name_vi: string;
  name_en?: string;
  description_vi?: string;
  description_en?: string;
  category: string;
  lat?: number;
  lng?: number;
  /** GeoJSON Polygon coordinates (rings of [lng, lat]) */
  polygon?: number[][][];
  floor?: number;
  contact_phone?: string;
  contact_email?: string;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ParseResult {
  rows: PlaceImportRow[];
  issues: ImportIssue[];
}

export interface ImportSummary {
  inserted: number;
  updated: number;
  issues: ImportIssue[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const str = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
};

const num = (v: unknown): number | undefined => {
  const s = str(v);
  if (s === undefined) return undefined;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

function checkAndBuild(raw: Record<string, unknown>, index: number, issues: ImportIssue[], polygon?: number[][][]): PlaceImportRow | null {
  const row = index + 1;
  const code = str(raw.code);
  const name_vi = str(raw.name_vi);
  const category = str(raw.category);
  if (!code) return issues.push({ row, message: 'missing "code"' }), null;
  if (!name_vi) return issues.push({ row, message: `${code}: missing "name_vi"` }), null;
  if (!category) return issues.push({ row, message: `${code}: missing "category"` }), null;

  const lat = num(raw.lat);
  const lng = num(raw.lng);
  const floor = num(raw.floor);
  if ((lat !== undefined && Number.isNaN(lat)) || (lng !== undefined && Number.isNaN(lng))) {
    return issues.push({ row, message: `${code}: lat/lng must be numbers` }), null;
  }
  if ((lat === undefined) !== (lng === undefined)) {
    return issues.push({ row, message: `${code}: lat and lng must be given together` }), null;
  }
  if (lat !== undefined && lng !== undefined && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
    return issues.push({ row, message: `${code}: coordinates out of range` }), null;
  }
  if (lat === undefined && !polygon) {
    return issues.push({ row, message: `${code}: needs lat/lng or a polygon` }), null;
  }
  if (floor !== undefined && !Number.isInteger(floor)) {
    return issues.push({ row, message: `${code}: floor must be an integer` }), null;
  }

  return {
    code,
    name_vi,
    category,
    name_en: str(raw.name_en),
    description_vi: str(raw.description_vi),
    description_en: str(raw.description_en),
    contact_phone: str(raw.contact_phone),
    contact_email: str(raw.contact_email),
    lat,
    lng,
    floor,
    polygon,
  };
}

/** Parse a CSV file. Header: code,name_vi,category,lat,lng[,name_en,description_vi,description_en,floor,contact_phone,contact_email] */
export function parseCsvPlaces(text: string): ParseResult {
  const table = parseCsv(text);
  const issues: ImportIssue[] = [];
  if (table.length === 0) return { rows: [], issues: [{ row: 0, message: 'empty file' }] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const rows: PlaceImportRow[] = [];
  table.slice(1).forEach((cells, i) => {
    const raw: Record<string, unknown> = {};
    header.forEach((h, c) => (raw[h] = cells[c]));
    const built = checkAndBuild(raw, i + 1, issues);
    if (built) rows.push(built);
  });
  return { rows, issues };
}

/**
 * Parse a GeoJSON FeatureCollection. Point features give the marker; Polygon
 * features give the footprint (the marker is then the polygon's centroid, computed in SQL).
 * Properties use the same names as the CSV columns.
 */
export function parseGeoJsonPlaces(text: string): ParseResult {
  const issues: ImportIssue[] = [];
  let doc: { type?: string; features?: Array<{ geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }> };
  try {
    doc = JSON.parse(text);
  } catch {
    return { rows: [], issues: [{ row: 0, message: 'invalid JSON' }] };
  }
  if (doc.type !== 'FeatureCollection' || !Array.isArray(doc.features)) {
    return { rows: [], issues: [{ row: 0, message: 'expected a GeoJSON FeatureCollection' }] };
  }
  const rows: PlaceImportRow[] = [];
  doc.features.forEach((f, i) => {
    const g = f.geometry;
    const props = { ...(f.properties ?? {}) };
    if (g?.type === 'Point' && Array.isArray(g.coordinates)) {
      props.lng = g.coordinates[0];
      props.lat = g.coordinates[1];
      const built = checkAndBuild(props, i, issues);
      if (built) rows.push(built);
    } else if (g?.type === 'Polygon' && Array.isArray(g.coordinates)) {
      const built = checkAndBuild(props, i, issues, g.coordinates as number[][][]);
      if (built) rows.push(built);
    } else {
      issues.push({ row: i + 1, message: `unsupported geometry "${g?.type ?? 'none'}" (use Point or Polygon)` });
    }
  });
  return { rows, issues };
}

export function parsePlacesFile(path: string): ParseResult {
  const text = readFileSync(path, 'utf-8');
  const ext = extname(path).toLowerCase();
  if (ext === '.csv') return parseCsvPlaces(text);
  if (ext === '.geojson' || ext === '.json') return parseGeoJsonPlaces(text);
  return { rows: [], issues: [{ row: 0, message: `unsupported file type "${ext}" (use .csv, .geojson or .json)` }] };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Upsert places by `code`, in one transaction (all or nothing).
 * Unknown category codes are reported as issues and abort the whole import.
 */
export async function importPlaces(
  rows: PlaceImportRow[],
  db: Pick<pg.Pool, 'connect'> = pool,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ImportSummary> {
  const client = await db.connect();
  const summary: ImportSummary = { inserted: 0, updated: 0, issues: [] };
  try {
    await client.query('BEGIN');

    const cats = new Map(
      (await client.query<{ id: number; code: string }>('SELECT id, code FROM categories')).rows.map((c) => [c.code, c.id]),
    );
    const unknown = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !cats.has(r.category))
      .map(({ r, i }) => ({ row: i + 1, message: `${r.code}: unknown category "${r.category}"` }));
    if (unknown.length > 0) {
      await client.query('ROLLBACK');
      summary.issues = unknown;
      return summary;
    }

    for (const r of rows) {
      const polygonWkt = r.polygon ? toWkt(r.polygon) : null;
      const { rows: res } = await client.query<{ inserted: boolean }>(
        `INSERT INTO places (category_id, code, name_vi, name_en, description_vi, description_en,
                             geom_point, geom_polygon, floor, contact_phone, contact_email)
         VALUES ($1, $2, $3, $4, $5, $6,
                 CASE WHEN $7::float8 IS NOT NULL THEN ST_SetSRID(ST_MakePoint($7, $8), 4326)
                      ELSE ST_PointOnSurface(ST_GeomFromText($9, 4326)) END,
                 CASE WHEN $9::text IS NOT NULL THEN ST_GeomFromText($9, 4326) END,
                 $10, $11, $12)
         ON CONFLICT (code) DO UPDATE SET
           category_id = EXCLUDED.category_id, name_vi = EXCLUDED.name_vi, name_en = EXCLUDED.name_en,
           description_vi = EXCLUDED.description_vi, description_en = EXCLUDED.description_en,
           geom_point = EXCLUDED.geom_point,
           geom_polygon = COALESCE(EXCLUDED.geom_polygon, places.geom_polygon),
           floor = EXCLUDED.floor, contact_phone = EXCLUDED.contact_phone, contact_email = EXCLUDED.contact_email,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [
          cats.get(r.category), r.code, r.name_vi, r.name_en ?? null, r.description_vi ?? null, r.description_en ?? null,
          r.lng ?? null, r.lat ?? null, polygonWkt, r.floor ?? null, r.contact_phone ?? null, r.contact_email ?? null,
        ],
      );
      if (res[0].inserted) summary.inserted++;
      else summary.updated++;
    }

    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return summary;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

function toWkt(rings: number[][][]): string {
  const wkt = rings.map((ring) => {
    const pts = ring.map(([x, y]) => `${x} ${y}`);
    if (pts[0] !== pts[pts.length - 1]) pts.push(pts[0]);
    return `(${pts.join(',')})`;
  });
  return `POLYGON(${wkt.join(',')})`;
}

// ---------------------------------------------------------------------------
// CLI: npm run db:import-places -- <file.csv|file.geojson> [--dry-run]
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: npm run db:import-places -- <file.csv|file.geojson> [--dry-run]');
    process.exit(2);
  }
  (async () => {
    const parsed = parsePlacesFile(file);
    for (const i of parsed.issues) console.warn(`  ⚠ row ${i.row}: ${i.message}`);
    if (parsed.issues.length > 0) {
      console.error(`❌ ${parsed.issues.length} problem(s) in ${file}; nothing imported.`);
      process.exit(1);
    }
    const summary = await importPlaces(parsed.rows, pool, { dryRun });
    for (const i of summary.issues) console.warn(`  ⚠ row ${i.row}: ${i.message}`);
    if (summary.issues.length > 0) {
      console.error('❌ Import aborted; nothing was changed.');
      process.exit(1);
    }
    console.log(`${dryRun ? '🧪 Dry run' : '✅ Imported'}: ${summary.inserted} inserted, ${summary.updated} updated`);
  })()
    .then(() => pool.end())
    .catch((err) => {
      console.error('❌ Import failed:', err);
      process.exit(1);
    });
}
