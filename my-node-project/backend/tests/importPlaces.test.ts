import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { importPlaces, parseCsv, parseCsvPlaces, parseGeoJsonPlaces } from '../src/db/importPlaces.js';
import { pool } from '../src/db/pool.js';
import { resetData } from './helpers/fixtures.js';

beforeEach(resetData);
afterAll(() => pool.end());

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded newlines, CRLF and BOM', () => {
    const csv = '\uFEFFa,b,c\r\n1,"x, y","say ""hi"""\r\n2,"line1\nline2",\r\n';
    expect(parseCsv(csv)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x, y', 'say "hi"'],
      ['2', 'line1\nline2', ''],
    ]);
  });
});

describe('parseCsvPlaces', () => {
  it('parses valid rows (decimal comma accepted)', () => {
    const { rows, issues } = parseCsvPlaces('code,name_vi,category,lat,lng,floor\nA1,Tòa A1,building,"20,96",105.74,3\n');
    expect(issues).toEqual([]);
    expect(rows[0]).toMatchObject({ code: 'A1', name_vi: 'Tòa A1', category: 'building', lat: 20.96, lng: 105.74, floor: 3 });
  });

  it('reports every problem with its line number', () => {
    const csv = [
      'code,name_vi,category,lat,lng,floor',
      ',No code,building,20.9,105.7,',
      'B,,building,20.9,105.7,',
      'C,Bad lat,building,abc,105.7,',
      'D,Half,building,20.9,,',
      'E,Range,building,95,105.7,',
      'F,Floor,building,20.9,105.7,1.5',
      'G,No geometry,building,,,',
    ].join('\n');
    const { rows, issues } = parseCsvPlaces(csv);
    expect(rows).toEqual([]);
    expect(issues.map((i) => i.row)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('parseGeoJsonPlaces', () => {
  it('reads points and polygons, rejects other geometries', () => {
    const doc = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [105.74, 20.96] }, properties: { code: 'P', name_vi: 'Point', category: 'gate' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] }, properties: { code: 'Q', name_vi: 'Poly', category: 'building' } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { code: 'R', name_vi: 'Line', category: 'building' } },
      ],
    };
    const { rows, issues } = parseGeoJsonPlaces(JSON.stringify(doc));
    expect(rows.map((r) => r.code)).toEqual(['P', 'Q']);
    expect(rows[0]).toMatchObject({ lat: 20.96, lng: 105.74 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ row: 3 });
  });

  it('rejects invalid input', () => {
    expect(parseGeoJsonPlaces('nope').issues[0].message).toBe('invalid JSON');
    expect(parseGeoJsonPlaces('{"type":"Feature"}').issues[0].message).toMatch(/FeatureCollection/);
  });
});

describe('importPlaces', () => {
  const row = { code: 'IMP-1', name_vi: 'Một', category: 'building', lat: 20.96, lng: 105.74 };

  it('inserts, then updates on re-import (idempotent by code)', async () => {
    expect(await importPlaces([row])).toMatchObject({ inserted: 1, updated: 0 });
    expect(await importPlaces([{ ...row, name_vi: 'Một (đổi tên)' }])).toMatchObject({ inserted: 0, updated: 1 });
    const { rows } = await pool.query("SELECT name_vi, ST_X(geom_point) AS lng FROM places WHERE code = 'IMP-1'");
    expect(rows).toHaveLength(1);
    expect(rows[0].name_vi).toBe('Một (đổi tên)');
    expect(rows[0].lng).toBeCloseTo(105.74);
  });

  it('derives the marker from a polygon footprint', async () => {
    const polygon = [[[105.74, 20.96], [105.741, 20.96], [105.741, 20.961], [105.74, 20.961], [105.74, 20.96]]];
    await importPlaces([{ code: 'IMP-P', name_vi: 'Poly', category: 'building', polygon }]);
    const { rows } = await pool.query(
      "SELECT ST_Within(geom_point, geom_polygon) AS inside FROM places WHERE code = 'IMP-P'",
    );
    expect(rows[0].inside).toBe(true);
  });

  it('is all-or-nothing when a category is unknown', async () => {
    const summary = await importPlaces([row, { ...row, code: 'IMP-2', category: 'nope' }]);
    expect(summary.issues).toHaveLength(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM places')).rows[0].n).toBe(0);
  });

  it('dry run changes nothing', async () => {
    expect(await importPlaces([row], pool, { dryRun: true })).toMatchObject({ inserted: 1 });
    expect((await pool.query('SELECT count(*)::int AS n FROM places')).rows[0].n).toBe(0);
  });
});
