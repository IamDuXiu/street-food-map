export type BBox = [number, number, number, number];

export interface CityDefinition {
  id: string;
  label: string;
  full: string;
  aliases: string[];
  centerLng: number;
  centerLat: number;
  bbox: BBox;
  zoom: number;
  public: boolean;
}

/** 店级公开门槛：店内至少一份 ≤15 元单人餐食。 */
export const SHOP_GATE_PRICE_FEN = 1500;
/** 餐食展示 sanity 上限（分）。 */
export const DISPLAY_PRICE_CAP_FEN = 20000;
/** 导入/投稿 sanity 上限（元）。 */
export const IMPORT_PRICE_YUAN_MAX = 200;
/** 采集脚本「廉价」关键词价。 */
export const BUDGET_PRICE_YUAN = 15;

/** 城市级坐标不得超出的全国范围（GCJ-02）。 */
export const NATIONAL_BOUNDS = {
  west: 73,
  south: 18,
  east: 135,
  north: 54,
} as const;

export const CITIES: CityDefinition[] = [
  {
    id: 'beijing',
    label: '北京',
    full: '北京市',
    aliases: ['北京', '帝都'],
    centerLng: 116.4074,
    centerLat: 39.9042,
    bbox: [115.424842, 39.453311, 117.505754, 41.060798],
    zoom: 9,
    public: true,
  },
  {
    id: 'shanghai',
    label: '上海',
    full: '上海市',
    aliases: ['上海', '沪'],
    centerLng: 121.4737,
    centerLat: 31.2304,
    bbox: [120.856856, 30.68824, 122.117996, 31.871578],
    zoom: 9,
    public: true,
  },
  {
    id: 'guangzhou',
    label: '广州',
    full: '广州市',
    aliases: ['广州', '羊城'],
    centerLng: 113.264,
    centerLat: 23.129,
    bbox: [112.95, 22.4, 113.74, 23.95],
    zoom: 10,
    public: true,
  },
  {
    id: 'shenzhen',
    label: '深圳',
    full: '深圳市',
    aliases: ['深圳', '鹏城'],
    centerLng: 114.0579,
    centerLat: 22.5984,
    bbox: [113.74, 22.43, 114.66, 22.88],
    zoom: 10,
    public: true,
  },
  {
    id: 'hangzhou',
    label: '杭州',
    full: '杭州市',
    aliases: ['杭州', '杭城'],
    centerLng: 120.1551,
    centerLat: 30.2741,
    bbox: [118.344969, 29.193098, 120.704457, 30.558539],
    zoom: 9,
    public: true,
  },
  {
    id: 'foshan',
    label: '佛山',
    full: '佛山市',
    aliases: ['佛山', '禅城'],
    centerLng: 113.122,
    centerLat: 23.028,
    bbox: [112.38, 22.63, 113.3, 23.57],
    zoom: 10,
    public: false,
  },
  {
    id: 'dongguan',
    label: '东莞',
    full: '东莞市',
    aliases: ['东莞'],
    centerLng: 113.751,
    centerLat: 23.02,
    bbox: [113.45, 22.65, 114.15, 23.15],
    zoom: 10,
    public: false,
  },
  {
    id: 'zhongshan',
    label: '中山',
    full: '中山市',
    aliases: ['中山'],
    centerLng: 113.392,
    centerLat: 22.517,
    bbox: [113.13, 22.2, 113.6, 22.75],
    zoom: 10,
    public: false,
  },
  {
    id: 'zhuhai',
    label: '珠海',
    full: '珠海市',
    aliases: ['珠海'],
    centerLng: 113.576,
    centerLat: 22.271,
    bbox: [113.05, 21.85, 114.15, 22.55],
    zoom: 10,
    public: false,
  },
  {
    id: 'huizhou',
    label: '惠州',
    full: '惠州市',
    aliases: ['惠州'],
    centerLng: 114.416,
    centerLat: 23.111,
    bbox: [113.85, 22.55, 115.35, 23.95],
    zoom: 9,
    public: false,
  },
  {
    id: 'jiangmen',
    label: '江门',
    full: '江门市',
    aliases: ['江门', '五邑'],
    centerLng: 113.081,
    centerLat: 22.579,
    bbox: [111.95, 21.7, 113.65, 23.1],
    zoom: 9,
    public: false,
  },
  {
    id: 'zhaoqing',
    label: '肇庆',
    full: '肇庆市',
    aliases: ['肇庆', '端州'],
    centerLng: 112.465,
    centerLat: 23.047,
    bbox: [111.35, 22.75, 112.85, 24.25],
    zoom: 9,
    public: false,
  },
];

export const PUBLIC_CITY_IDS = CITIES.filter((city) => city.public).map(
  (city) => city.id,
);

const PUBLIC_CITY_RANK = new Map(
  PUBLIC_CITY_IDS.map((id, index) => [id, index]),
);

export function isPublicCity(id: string): boolean {
  return PUBLIC_CITY_RANK.has(id);
}

export function publicCityRank(id: string): number {
  return PUBLIC_CITY_RANK.get(id) ?? Number.POSITIVE_INFINITY;
}

export function findCity(token: string | undefined): CityDefinition | undefined {
  if (!token) return undefined;
  const value = token.trim();
  if (!value) return undefined;
  return CITIES.find(
    (city) =>
      city.id === value ||
      city.label === value ||
      city.full === value ||
      city.aliases.includes(value),
  );
}

export function coordsInBbox(lng: number, lat: number, bbox: BBox): boolean {
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

export function findPublicCityByCoords(
  lng: number,
  lat: number,
): CityDefinition | undefined {
  return CITIES.find(
    (city) => city.public && coordsInBbox(lng, lat, city.bbox),
  );
}

export function clampDisplayPriceFen(value: number | undefined): number {
  return Math.min(value ?? DISPLAY_PRICE_CAP_FEN, DISPLAY_PRICE_CAP_FEN);
}
