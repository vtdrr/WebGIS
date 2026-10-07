import { describe, expect, it } from 'vitest';
import { makePlace } from '../../test/fixtures';
import { emptyForm, formToPayload, placeToForm, polygonCentroid, validateForm } from './placeForm';

const RING = [[105.74, 20.96], [105.741, 20.96], [105.741, 20.961], [105.74, 20.96]];

describe('placeToForm', () => {
  it('converts a place to editable strings, opening the polygon ring', () => {
    const form = placeToForm(
      makePlace({
        floor: 2,
        geom_polygon: { type: 'Polygon', coordinates: [RING] },
        opening_hours: { 'mon-fri': '07:00-22:00' },
        attributes: { has_wifi: true, has_ac: false, capacity: 40, custom: 'x' },
      }),
    );
    expect(form).toMatchObject({ floor: '2', lat: '20.9626', lng: '105.7487', category_id: '1', capacity: '40' });
    expect(form.polygon).toHaveLength(3);
    expect(form.hours).toEqual([{ day: 'mon-fri', time: '07:00-22:00' }]);
    expect(form.amenities).toEqual({ has_wifi: true, has_ac: false });
    expect(form.extraAttributes).toEqual({ custom: 'x' });
  });

  it('handles a bare place (nulls)', () => {
    const form = placeToForm(makePlace({ code: null, name_en: null, geom_point: null, floor: null, images: undefined as never }));
    expect(form).toMatchObject({ code: '', name_en: '', lat: '', lng: '', floor: '', images: [] });
  });
});

describe('formToPayload', () => {
  const base = () => ({ ...emptyForm(), name_vi: ' Tòa B ', category_id: '3', lat: '20.96', lng: '105.74' });

  it('create: omits empty optional fields', () => {
    const payload = formToPayload(base(), 'create');
    expect(payload).toEqual({
      category_id: 3, name_vi: 'Tòa B', geom_point: [105.74, 20.96], images: [], attributes: {},
    });
  });

  it('update: sends nulls so cleared fields are removed', () => {
    const payload = formToPayload(base(), 'update');
    expect(payload).toMatchObject({
      code: null, name_en: null, description_vi: null, contact_email: null, floor: null, opening_hours: null, geom_polygon: null,
    });
  });

  it('builds a closed polygon ring and a centroid marker when there is no point', () => {
    const form = { ...base(), lat: '', lng: '', polygon: [[0, 0], [2, 0], [2, 2], [0, 2]] as Array<[number, number]> };
    const payload = formToPayload(form, 'create');
    expect(payload.geom_polygon?.coordinates[0]).toEqual([[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]);
    expect(payload.geom_point).toEqual([1, 1]);
  });

  it('collects hours, amenities, capacity and keeps unknown attributes', () => {
    const form = {
      ...base(),
      hours: [{ day: 'sat', time: '08:00-17:00' }, { day: '', time: 'ignored' }],
      amenities: { has_wifi: true, has_ac: false },
      capacity: '50',
      extraAttributes: { custom: 1 },
      floor: '4',
    };
    const payload = formToPayload(form, 'create');
    expect(payload.opening_hours).toEqual({ sat: '08:00-17:00' });
    expect(payload.attributes).toEqual({ custom: 1, has_wifi: true, capacity: 50 });
    expect(payload.floor).toBe(4);
  });

  it('round-trips a place through the form', () => {
    const place = makePlace({
      floor: 1, contact_phone: '024', geom_polygon: { type: 'Polygon', coordinates: [RING] },
      opening_hours: { sun: 'closed' }, attributes: { has_ac: true },
    });
    const payload = formToPayload(placeToForm(place), 'update');
    expect(payload).toMatchObject({
      category_id: 1, code: 'A1', name_vi: 'Tòa A1', floor: 1, contact_phone: '024',
      opening_hours: { sun: 'closed' }, attributes: { has_ac: true },
      geom_point: [105.7487, 20.9626],
    });
    expect(payload.geom_polygon?.coordinates[0]).toEqual(RING);
  });
});

describe('validateForm', () => {
  const valid = () => ({ ...emptyForm(), name_vi: 'A', category_id: '1', lat: '20.9', lng: '105.7' });

  it('accepts a valid form', () => expect(validateForm(valid())).toEqual([]));

  it('requires name and category', () => {
    expect(validateForm({ ...valid(), name_vi: ' ', category_id: '' })).toEqual([
      'admin.validation.name',
      'admin.validation.category',
    ]);
  });

  it('requires a location or a polygon with 3+ vertices', () => {
    expect(validateForm({ ...valid(), lat: '', lng: '' })).toContain('admin.validation.geometry');
    expect(validateForm({ ...valid(), polygon: [[0, 0], [1, 1]] })).toContain('admin.validation.geometry');
    expect(validateForm({ ...valid(), lat: '', lng: '', polygon: [[0, 0], [1, 0], [1, 1]] })).toEqual([]);
  });

  it('rejects bad coordinates, floor and capacity', () => {
    expect(validateForm({ ...valid(), lat: '95' })).toContain('admin.validation.coordinates');
    expect(validateForm({ ...valid(), lng: 'abc' })).toContain('admin.validation.coordinates');
    expect(validateForm({ ...valid(), lat: '20.9', lng: '' })).toContain('admin.validation.coordinates');
    expect(validateForm({ ...valid(), floor: '1.5' })).toContain('admin.validation.floor');
    expect(validateForm({ ...valid(), capacity: '0' })).toContain('admin.validation.capacity');
    expect(validateForm({ ...valid(), capacity: '-3' })).toContain('admin.validation.capacity');
  });
});

describe('polygonCentroid', () => {
  it('averages the vertices', () => {
    expect(polygonCentroid([[0, 0], [4, 0], [4, 2], [0, 2]])).toEqual([2, 1]);
  });
});
