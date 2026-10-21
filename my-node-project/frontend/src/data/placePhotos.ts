import type { Place, PlaceImage } from '../types';

export interface PlacePhotoCandidate {
  url: string;
  caption: string;
  campusReference: boolean;
}

interface CampusPhoto {
  url: string;
  caption: string;
}

const campusPhotoGroups: Array<{ codes: string[]; photo: CampusPhoto }> = [
  {
    codes: [
      'A1-MAIN',
      'OSM-W-1113215768', 'OSM-W-1183713531', 'OSM-W-1183713520', 'OSM-W-1183713532',
      'OSM-W-1183713521', 'OSM-W-1183713533', 'OSM-W-1183713522', 'OSM-W-1183713534',
    ],
    photo: { url: '/place-images/buildings-a1-a8.jpg', caption: 'Khu giảng đường A1–A8' },
  },
  {
    codes: ['OSM-W-1179878047', 'OSM-W-1179878048'],
    photo: { url: '/place-images/buildings-a9-a10.jpg', caption: 'Tòa nhà A9–A10' },
  },
  {
    codes: ['OSM-W-892574229', 'OSM-W-1183713526', 'OSM-W-1183713525', 'OSM-W-1113215769'],
    photo: { url: '/place-images/buildings-b.jpg', caption: 'Khu thực hành các tòa B' },
  },
  {
    codes: ['CAMPUS-LIBRARY-A10', 'LIB-MAIN'],
    photo: { url: '/place-images/library.jpg', caption: 'Không gian thư viện' },
  },
  {
    codes: ['CAN-MAIN', 'OSM-W-892560481', 'OSM-W-1183713524'],
    photo: { url: '/place-images/canteen.jpg', caption: 'Khu vực căng tin' },
  },
  {
    codes: ['DOR-A', 'OSM-W-892574245', 'OSM-W-892560474', 'OSM-W-892560472'],
    photo: { url: '/place-images/dormitories.png', caption: 'Khu vực ký túc xá' },
  },
  {
    codes: ['PK-MAIN', 'CAMPUS-PARKING-1', 'CAMPUS-PARKING-2', 'CAMPUS-PARKING-3', 'CAMPUS-PARKING-4'],
    photo: { url: '/place-images/parking.jpg', caption: 'Khu vực để xe trong trường' },
  },
  {
    codes: ['OSM-W-892560469'],
    photo: { url: '/place-images/football-field.jpg', caption: 'Sân bóng' },
  },
  {
    codes: ['OSM-W-892574249'],
    photo: { url: '/place-images/sports-hall.jpg', caption: 'Nhà thi đấu' },
  },
  {
    codes: ['CAMPUS-TENNIS'],
    photo: { url: '/place-images/tennis-court.jpg', caption: 'Sân tennis' },
  },
  {
    codes: ['OSM-W-1183713535'],
    photo: { url: '/place-images/medical-center.jpg', caption: 'Khu vực y tế' },
  },
];

const campusPhotosByCode = new Map(
  campusPhotoGroups.flatMap(({ codes, photo }) => codes.map((code) => [code, photo] as const)),
);

/** Resolves only explicitly reviewed place codes; names are not used as identifiers. */
export function getCampusPlacePhoto(code: string | null | undefined): CampusPhoto | null {
  return code ? campusPhotosByCode.get(code) ?? null : null;
}

/** Uploaded place-specific images take precedence over the bundled campus reference photos. */
export function getPlacePhotoCandidates(place: Place): PlacePhotoCandidate[] {
  const uploaded = [...(place.images ?? [])]
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary)))
    .filter((image): image is PlaceImage & { url: string } => Boolean(image.url))
    .map((image) => ({ url: image.url, caption: image.caption?.trim() || place.name_vi, campusReference: false }));
  const campus = getCampusPlacePhoto(place.code);
  const candidates = campus ? [...uploaded, { ...campus, campusReference: true }] : uploaded;

  return candidates.filter((candidate, index) => candidates.findIndex((other) => other.url === candidate.url) === index);
}
