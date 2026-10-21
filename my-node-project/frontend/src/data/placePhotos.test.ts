import { describe, expect, it } from 'vitest';
import { makePlace } from '../test/fixtures';
import { getCampusPlacePhoto, getPlacePhotoCandidates } from './placePhotos';

describe('campus place photo mapping', () => {
  it('maps only reviewed campus codes to the corresponding group photograph', () => {
    expect(getCampusPlacePhoto('OSM-W-1179878048')).toEqual({
      url: '/place-images/buildings-a9-a10.jpg',
      caption: 'Tòa nhà A9–A10',
    });
    expect(getCampusPlacePhoto('CAMPUS-PARKING-3')?.url).toBe('/place-images/parking.jpg');
    expect(getCampusPlacePhoto('OSM-W-892574229')?.url).toBe('/place-images/buildings-b.jpg');
  });

  it('does not guess a photo from a name or an unknown code', () => {
    expect(getCampusPlacePhoto('UNKNOWN-PLACE')).toBeNull();
    expect(getCampusPlacePhoto(null)).toBeNull();
    expect(getCampusPlacePhoto(undefined)).toBeNull();
    expect(getPlacePhotoCandidates(makePlace({ code: 'UNKNOWN-PLACE', name_vi: 'Thư viện' }))).toEqual([]);
  });

  it('prefers a place-specific uploaded primary image and retains a reviewed fallback', () => {
    const candidates = getPlacePhotoCandidates(makePlace({
      code: 'CAMPUS-LIBRARY-A10',
      images: [
        { url: '/uploads/other.jpg', caption: 'Ảnh bổ sung' },
        { url: '/uploads/primary.jpg', caption: 'Ảnh đã duyệt', is_primary: true },
      ],
    }));

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      '/uploads/primary.jpg',
      '/uploads/other.jpg',
      '/place-images/library.jpg',
    ]);
  });
});
