import type { MapViewport } from './types';

export type RegionLevel = 'city' | 'district' | 'business_area';
export type CoverageStatus = 'live' | 'planned';

export interface ShenzhenRegion extends MapViewport {
  level: RegionLevel;
  coverage: CoverageStatus;
  districtId?: string;
}

export interface ShenzhenDistrict extends ShenzhenRegion {
  level: 'district';
  businessAreas: ShenzhenRegion[];
}

export interface RegionCityOption {
  id: string;
  label: string;
  centerLng: number;
  centerLat: number;
  bbox: [number, number, number, number];
  zoom: number;
}

export interface ShenzhenRegionCatalog {
  city: ShenzhenRegion;
  districts: ShenzhenDistrict[];
  cities?: RegionCityOption[];
}

const area = (
  id: string,
  label: string,
  districtId: string,
  centerLng: number,
  centerLat: number,
  bbox: [number, number, number, number],
  coverage: CoverageStatus = 'planned',
): ShenzhenRegion => ({
  id,
  label,
  districtId,
  level: 'business_area',
  coverage,
  subtitle: coverage === 'live' ? '已有饭签' : '已开放浏览',
  centerLng,
  centerLat,
  bbox,
  zoom: 14,
});

const district = (
  id: string,
  label: string,
  centerLng: number,
  centerLat: number,
  bbox: [number, number, number, number],
  businessAreas: ShenzhenRegion[],
  coverage: CoverageStatus = 'planned',
): ShenzhenDistrict => ({
  id,
  label,
  level: 'district',
  coverage,
  subtitle: coverage === 'live' ? '部分商圈已有饭签' : '已开放浏览',
  centerLng,
  centerLat,
  bbox,
  zoom: 12,
  businessAreas,
});

export const SHENZHEN_CITY: ShenzhenRegion = {
  id: 'shenzhen',
  label: '深圳市',
  level: 'city',
  coverage: 'live',
  subtitle: '全市范围 · 当前数据集中在南山区',
  centerLng: 114.0579,
  centerLat: 22.5984,
  bbox: [113.74, 22.43, 114.66, 22.88],
  zoom: 10,
};

export const SHENZHEN_DISTRICTS: ShenzhenDistrict[] = [
  district('futian', '福田区', 114.055, 22.541, [113.9, 22.5, 114.1, 22.63], [
    area('futian-cbd', '福田中心区 / 会展中心', 'futian', 114.055, 22.535, [114.035, 22.515, 114.075, 22.555]),
    area('huaqiangbei', '华强北', 'futian', 114.086, 22.548, [114.069, 22.535, 114.103, 22.565]),
    area('chegongmiao', '车公庙', 'futian', 114.025, 22.534, [114.006, 22.519, 114.044, 22.551]),
    area('shangmeilin', '上梅林', 'futian', 114.059, 22.572, [114.04, 22.557, 114.078, 22.589]),
    area('xiasha', '下沙', 'futian', 114.019, 22.527, [114.002, 22.513, 114.036, 22.543]),
    area('futian-port', '福田口岸', 'futian', 114.069, 22.515, [114.054, 22.502, 114.084, 22.529]),
  ]),
  district('luohu', '罗湖区', 114.131, 22.555, [114.08, 22.5, 114.23, 22.65], [
    area('dongmen', '东门', 'luohu', 114.12, 22.55, [114.103, 22.536, 114.138, 22.566]),
    area('guomao', '国贸 / 人民南', 'luohu', 114.117, 22.539, [114.101, 22.525, 114.133, 22.554]),
    area('the-mixc-luohu', '万象城', 'luohu', 114.107, 22.542, [114.094, 22.53, 114.121, 22.554]),
    area('sungang', '笋岗', 'luohu', 114.116, 22.57, [114.098, 22.555, 114.134, 22.585]),
    area('shuibei', '水贝', 'luohu', 114.124, 22.579, [114.108, 22.565, 114.14, 22.593]),
    area('huangbeiling', '黄贝岭', 'luohu', 114.138, 22.551, [114.123, 22.537, 114.153, 22.566]),
  ]),
  district('nanshan', '南山区', 113.93, 22.54, [113.78, 22.47, 114, 22.65], [
    area('science-park', '科技园', 'nanshan', 113.948, 22.538, [113.929, 22.522, 113.966, 22.554], 'live'),
    area('shenda-yuehai', '深大粤海', 'nanshan', 113.933, 22.527, [113.916, 22.514, 113.946, 22.539], 'live'),
    area('houhai-coastal-city', '后海 / 海岸城', 'nanshan', 113.942, 22.51, [113.922, 22.493, 113.962, 22.526]),
    area('nanshan-center', '南山中心区', 'nanshan', 113.924, 22.519, [113.905, 22.502, 113.943, 22.535]),
    area('shekou', '蛇口', 'nanshan', 113.918, 22.486, [113.89, 22.465, 113.946, 22.507]),
    area('qianhai', '前海', 'nanshan', 113.894, 22.511, [113.865, 22.485, 113.922, 22.537]),
    area('xili', '西丽', 'nanshan', 113.955, 22.58, [113.93, 22.558, 113.98, 22.603]),
    area('overseas-chinese-town', '华侨城', 'nanshan', 113.986, 22.537, [113.965, 22.519, 114.006, 22.555]),
  ], 'live'),
  district('yantian', '盐田区', 114.236, 22.557, [114.18, 22.53, 114.36, 22.68], [
    area('shatoujiao', '沙头角', 'yantian', 114.228, 22.555, [114.208, 22.539, 114.248, 22.572]),
    area('haishan', '海山', 'yantian', 114.239, 22.563, [114.223, 22.55, 114.255, 22.577]),
    area('yantian-port', '盐田港', 'yantian', 114.269, 22.582, [114.247, 22.56, 114.292, 22.603]),
    area('dameisha', '大梅沙', 'yantian', 114.309, 22.599, [114.287, 22.58, 114.331, 22.618]),
    area('xiaomeisha', '小梅沙', 'yantian', 114.329, 22.604, [114.315, 22.591, 114.343, 22.617]),
  ]),
  district('baoan', '宝安区', 113.884, 22.686, [113.75, 22.53, 113.95, 22.82], [
    area('baoan-center', '宝安中心', 'baoan', 113.887, 22.554, [113.866, 22.536, 113.908, 22.571]),
    area('xin-an', '新安', 'baoan', 113.907, 22.571, [113.887, 22.553, 113.927, 22.589]),
    area('xixiang', '西乡', 'baoan', 113.864, 22.581, [113.841, 22.56, 113.887, 22.602]),
    area('gushu', '固戍', 'baoan', 113.835, 22.602, [113.815, 22.584, 113.855, 22.621]),
    area('fuyong', '福永', 'baoan', 113.814, 22.673, [113.79, 22.651, 113.838, 22.695]),
    area('shajing', '沙井', 'baoan', 113.803, 22.728, [113.778, 22.704, 113.828, 22.752]),
    area('songgang', '松岗', 'baoan', 113.837, 22.778, [113.812, 22.755, 113.862, 22.801]),
    area('shiyan', '石岩', 'baoan', 113.938, 22.679, [113.912, 22.655, 113.964, 22.703]),
  ]),
  district('longgang', '龙岗区', 114.247, 22.72, [114.02, 22.57, 114.38, 22.86], [
    area('longgang-center', '龙岗中心城', 'longgang', 114.247, 22.72, [114.22, 22.696, 114.274, 22.744]),
    area('dayun', '大运', 'longgang', 114.218, 22.69, [114.194, 22.669, 114.242, 22.711]),
    area('buji', '布吉', 'longgang', 114.121, 22.602, [114.098, 22.582, 114.144, 22.622]),
    area('bantian', '坂田', 'longgang', 114.066, 22.626, [114.039, 22.603, 114.093, 22.649]),
    area('pinghu', '平湖', 'longgang', 114.132, 22.697, [114.107, 22.675, 114.157, 22.719]),
    area('henggang', '横岗', 'longgang', 114.192, 22.65, [114.168, 22.629, 114.216, 22.671]),
    area('nanwan', '南湾', 'longgang', 114.143, 22.626, [114.119, 22.605, 114.167, 22.647]),
    area('baolong', '宝龙', 'longgang', 114.286, 22.684, [114.26, 22.661, 114.312, 22.707]),
  ]),
  district('longhua', '龙华区', 114.044, 22.696, [113.95, 22.58, 114.1, 22.79], [
    area('longhua-center', '龙华中心', 'longhua', 114.027, 22.659, [114.005, 22.639, 114.049, 22.679]),
    area('minzhi-north-station', '民治 / 深圳北站', 'longhua', 114.029, 22.611, [114.006, 22.59, 114.052, 22.632]),
    area('hongshan', '红山', 'longhua', 114.023, 22.621, [114.006, 22.606, 114.04, 22.636]),
    area('shangtang', '上塘', 'longhua', 114.012, 22.641, [113.995, 22.626, 114.029, 22.656]),
    area('qinghu', '清湖', 'longhua', 114.047, 22.665, [114.03, 22.65, 114.064, 22.68]),
    area('guanlan', '观澜', 'longhua', 114.051, 22.72, [114.025, 22.697, 114.077, 22.743]),
    area('dalang', '大浪', 'longhua', 113.998, 22.69, [113.974, 22.668, 114.022, 22.712]),
  ]),
  district('pingshan', '坪山区', 114.35, 22.69, [114.25, 22.61, 114.48, 22.82], [
    area('pingshan-center', '坪山中心', 'pingshan', 114.35, 22.69, [114.326, 22.669, 114.374, 22.711]),
    area('pingshan-station', '坪山高铁站', 'pingshan', 114.326, 22.708, [114.31, 22.694, 114.342, 22.722]),
    area('kengzi', '坑梓', 'pingshan', 114.377, 22.747, [114.354, 22.726, 114.4, 22.768]),
    area('yanzihu', '燕子湖', 'pingshan', 114.367, 22.701, [114.349, 22.684, 114.385, 22.718]),
    area('sztu', '深圳技术大学', 'pingshan', 114.414, 22.724, [114.394, 22.706, 114.434, 22.742]),
  ]),
  district('guangming', '光明区', 113.936, 22.748, [113.84, 22.65, 114, 22.86], [
    area('guangming-center', '光明中心', 'guangming', 113.936, 22.748, [113.914, 22.728, 113.958, 22.768]),
    area('guangming-science-city', '光明科学城', 'guangming', 113.944, 22.776, [113.92, 22.754, 113.968, 22.798]),
    area('gongming', '公明', 'guangming', 113.899, 22.776, [113.876, 22.755, 113.922, 22.797]),
    area('fenghuangcheng', '凤凰城', 'guangming', 113.949, 22.736, [113.931, 22.72, 113.967, 22.752]),
    area('honghuashan', '红花山', 'guangming', 113.892, 22.786, [113.876, 22.771, 113.908, 22.801]),
    area('changzhen', '长圳', 'guangming', 113.946, 22.704, [113.928, 22.688, 113.964, 22.72]),
  ]),
  district('dapeng', '大鹏新区', 114.48, 22.59, [114.39, 22.46, 114.65, 22.68], [
    area('kuichong', '葵涌', 'dapeng', 114.425, 22.633, [114.401, 22.611, 114.449, 22.655]),
    area('dapeng-fortress', '大鹏所城', 'dapeng', 114.498, 22.596, [114.479, 22.579, 114.517, 22.613]),
    area('jiaochangwei', '较场尾', 'dapeng', 114.505, 22.595, [114.491, 22.582, 114.519, 22.608]),
    area('nanao', '南澳', 'dapeng', 114.486, 22.535, [114.465, 22.516, 114.507, 22.554]),
    area('xichong', '西涌', 'dapeng', 114.608, 22.488, [114.58, 22.466, 114.636, 22.51]),
  ]),
];

export const SHENZHEN_REGION_CATALOG: ShenzhenRegionCatalog = {
  city: SHENZHEN_CITY,
  districts: SHENZHEN_DISTRICTS,
};

export const SHENZHEN_REGIONS: ShenzhenRegion[] = [
  SHENZHEN_CITY,
  ...SHENZHEN_DISTRICTS.flatMap((item) => [item, ...item.businessAreas]),
];

export function findShenzhenRegion(id: string) {
  return SHENZHEN_REGIONS.find((region) => region.id === id);
}
