export type ZoneId = string;

export type Tag =
  | '有肉有菜'
  | '分量足'
  | '早餐'
  | '夜宵'
  | '可打包'
  | '园区食堂'
  | '学校食堂'
  | '便利店';

export type VerificationLevel = '高可信' | '中高可信' | '近期核验';

export interface Meal {
  id: string;
  name: string;
  priceFen: number;
  category: string;
  description: string;
  observedAt: string;
  method: string;
  freshness: '近期核验' | '有效' | '可能过期' | '已核验' | '超过 180 天';
}

export interface Place {
  id: string;
  zoneId: ZoneId;
  name: string;
  address: string;
  lng: number;
  lat: number;
  category: string;
  access: string;
  tags: Tag[];
  note: string;
  meals: Meal[];
  verification: VerificationLevel;
  distanceMeters?: number;
}

export interface MapViewport {
  id: string;
  label: string;
  subtitle: string;
  centerLng: number;
  centerLat: number;
  bbox?: [number, number, number, number];
  zoom?: number;
  level?: 'city' | 'district' | 'business_area' | 'nearby';
  coverage?: 'live' | 'planned';
}
