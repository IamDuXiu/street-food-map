/**
 * 珠三角其余 8 市的行政区种子（city → district）。
 *
 * 数据来源：腾讯地图 WebService `district/v1/getchildren`（get_polygon=1），
 * 坐标系 GCJ-02，数据版本 2026-04-28；bbox 由官方简化边界取经纬度范围，
 * 中心取官方行政区中心。东莞/中山为不设区的地级市（直筒子市），只保留市级。
 * 本文件由一次性脚本生成后固化，运行时不依赖腾讯接口；如需更新请重新生成。
 */

export interface DistrictSeed {
  cityId: string;
  id: string;
  name: string;
  centerLng: number;
  centerLat: number;
  bbox: [number, number, number, number];
  zoom: number;
  sortOrder: number;
}

export const PEARL_RIVER_DISTRICTS: DistrictSeed[] = [
  { cityId: 'guangzhou', id: 'guangzhou-liwan', name: '荔湾区', centerLng: 113.218998, centerLat: 23.107123, bbox: [113.177917, 23.046774, 113.276807, 23.159397], zoom: 11, sortOrder: 0 },
  { cityId: 'guangzhou', id: 'guangzhou-yuexiu', name: '越秀区', centerLng: 113.267065, centerLat: 23.128673, bbox: [113.242854, 23.105383, 113.323006, 23.159579], zoom: 11, sortOrder: 1 },
  { cityId: 'guangzhou', id: 'guangzhou-haizhu', name: '海珠区', centerLng: 113.317412, centerLat: 23.084003, bbox: [113.24224, 23.054542, 113.415939, 23.11369], zoom: 11, sortOrder: 2 },
  { cityId: 'guangzhou', id: 'guangzhou-tianhe', name: '天河区', centerLng: 113.361597, centerLat: 23.124817, bbox: [113.30633, 23.098224, 113.447998, 23.231498], zoom: 11, sortOrder: 3 },
  { cityId: 'guangzhou', id: 'guangzhou-baiyun', name: '白云区', centerLng: 113.2732, centerLat: 23.157159, bbox: [113.150015, 23.141105, 113.510084, 23.428546], zoom: 11, sortOrder: 4 },
  { cityId: 'guangzhou', id: 'guangzhou-huangpu', name: '黄埔区', centerLng: 113.480613, centerLat: 23.181355, bbox: [113.399959, 23.030294, 113.602956, 23.411848], zoom: 11, sortOrder: 5 },
  { cityId: 'guangzhou', id: 'guangzhou-panyu', name: '番禺区', centerLng: 113.383917, centerLat: 22.93756, bbox: [113.24974, 22.856837, 113.5751, 23.080255], zoom: 11, sortOrder: 6 },
  { cityId: 'guangzhou', id: 'guangzhou-huadu', name: '花都区', centerLng: 113.220125, centerLat: 23.404326, bbox: [112.975154, 23.25015, 113.473086, 23.609502], zoom: 11, sortOrder: 7 },
  { cityId: 'guangzhou', id: 'guangzhou-nansha', name: '南沙区', centerLng: 113.525178, centerLat: 22.801435, bbox: [113.296141, 22.557137, 113.700606, 22.907876], zoom: 11, sortOrder: 8 },
  { cityId: 'guangzhou', id: 'guangzhou-conghua', name: '从化区', centerLng: 113.586988, centerLat: 23.548287, bbox: [113.281547, 23.370952, 114.059269, 23.932941], zoom: 11, sortOrder: 9 },
  { cityId: 'guangzhou', id: 'guangzhou-zengcheng', name: '增城区', centerLng: 113.810734, centerLat: 23.261452, bbox: [113.556892, 23.084203, 114.001529, 23.619769], zoom: 11, sortOrder: 10 },
  { cityId: 'foshan', id: 'foshan-chancheng', name: '禅城区', centerLng: 113.122532, centerLat: 23.009475, bbox: [112.978944, 22.922258, 113.168303, 23.06219], zoom: 11, sortOrder: 0 },
  { cityId: 'foshan', id: 'foshan-nanhai', name: '南海区', centerLng: 113.143246, centerLat: 23.028875, bbox: [112.846645, 22.798367, 113.257804, 23.299136], zoom: 11, sortOrder: 1 },
  { cityId: 'foshan', id: 'foshan-shunde', name: '顺德区', centerLng: 113.293197, centerLat: 22.805413, bbox: [113.00906, 22.673691, 113.393427, 22.994267], zoom: 11, sortOrder: 2 },
  { cityId: 'foshan', id: 'foshan-sanshui', name: '三水区', centerLng: 112.897271, centerLat: 23.156675, bbox: [112.769438, 22.955841, 113.046987, 23.554035], zoom: 11, sortOrder: 3 },
  { cityId: 'foshan', id: 'foshan-gaoming', name: '高明区', centerLng: 112.891839, centerLat: 22.89984, bbox: [112.392478, 22.642244, 112.92295, 23.014774], zoom: 11, sortOrder: 4 },
  { cityId: 'zhuhai', id: 'zhuhai-xiangzhou', name: '香洲区', centerLng: 113.543372, centerLat: 22.265635, bbox: [113.41933, 22.019285, 114.323475, 22.416394], zoom: 11, sortOrder: 0 },
  { cityId: 'zhuhai', id: 'zhuhai-doumen', name: '斗门区', centerLng: 113.296228, centerLat: 22.209134, bbox: [113.105626, 22.080226, 113.443752, 22.397852], zoom: 11, sortOrder: 1 },
  { cityId: 'zhuhai', id: 'zhuhai-jinwan', name: '金湾区', centerLng: 113.363907, centerLat: 22.147856, bbox: [113.110312, 21.833144, 113.443752, 22.150681], zoom: 11, sortOrder: 2 },
  { cityId: 'huizhou', id: 'huizhou-huicheng', name: '惠城区', centerLng: 114.382526, centerLat: 23.084657, bbox: [114.124038, 22.914483, 114.782951, 23.41158], zoom: 11, sortOrder: 0 },
  { cityId: 'huizhou', id: 'huizhou-huiyang', name: '惠阳区', centerLng: 114.456107, centerLat: 22.789431, bbox: [114.229202, 22.662495, 114.707116, 23.128154], zoom: 11, sortOrder: 1 },
  { cityId: 'huizhou', id: 'huizhou-boluo', name: '博罗县', centerLng: 114.289602, centerLat: 23.172587, bbox: [113.844691, 23.047529, 114.699201, 23.707029], zoom: 11, sortOrder: 2 },
  { cityId: 'huizhou', id: 'huizhou-huidong', name: '惠东县', centerLng: 114.720136, centerLat: 22.984831, bbox: [114.558656, 22.541481, 115.425264, 23.383354], zoom: 11, sortOrder: 3 },
  { cityId: 'huizhou', id: 'huizhou-longmen', name: '龙门县', centerLng: 114.254898, centerLat: 23.727873, bbox: [113.832604, 23.334895, 114.422077, 23.960116], zoom: 11, sortOrder: 4 },
  { cityId: 'jiangmen', id: 'jiangmen-pengjiang', name: '蓬江区', centerLng: 113.078914, centerLat: 22.595285, bbox: [112.92148, 22.561408, 113.170619, 22.807751], zoom: 11, sortOrder: 0 },
  { cityId: 'jiangmen', id: 'jiangmen-jianghai', name: '江海区', centerLng: 113.111029, centerLat: 22.561301, bbox: [113.073475, 22.483157, 113.188706, 22.601926], zoom: 11, sortOrder: 1 },
  { cityId: 'jiangmen', id: 'jiangmen-xinhui', name: '新会区', centerLng: 113.034454, centerLat: 22.458519, bbox: [112.795589, 22.114476, 113.262664, 22.569051], zoom: 11, sortOrder: 2 },
  { cityId: 'jiangmen', id: 'jiangmen-taishan', name: '台山市', centerLng: 112.793812, centerLat: 22.251947, bbox: [112.307966, 21.565789, 113.034576, 22.440113], zoom: 11, sortOrder: 3 },
  { cityId: 'jiangmen', id: 'jiangmen-kaiping', name: '开平市', centerLng: 112.698113, centerLat: 22.377378, bbox: [112.24404, 21.971, 112.813368, 22.664218], zoom: 11, sortOrder: 4 },
  { cityId: 'jiangmen', id: 'jiangmen-heshan', name: '鹤山市', centerLng: 112.964203, centerLat: 22.765912, bbox: [112.476587, 22.473985, 113.049525, 22.856291], zoom: 11, sortOrder: 5 },
  { cityId: 'jiangmen', id: 'jiangmen-enping', name: '恩平市', centerLng: 112.304904, centerLat: 22.183743, bbox: [112.004249, 21.914445, 112.527838, 22.492246], zoom: 11, sortOrder: 6 },
  { cityId: 'zhaoqing', id: 'zhaoqing-duanzhou', name: '端州区', centerLng: 112.485577, centerLat: 23.051847, bbox: [112.408407, 23.038447, 112.548036, 23.172424], zoom: 11, sortOrder: 0 },
  { cityId: 'zhaoqing', id: 'zhaoqing-dinghu', name: '鼎湖区', centerLng: 112.56738, centerLat: 23.159062, bbox: [112.447664, 23.09345, 112.780012, 23.308289], zoom: 11, sortOrder: 1 },
  { cityId: 'zhaoqing', id: 'zhaoqing-gaoyao', name: '高要区', centerLng: 112.458055, centerLat: 23.02474, bbox: [112.186883, 22.769758, 112.834085, 23.433135], zoom: 11, sortOrder: 2 },
  { cityId: 'zhaoqing', id: 'zhaoqing-guangning', name: '广宁县', centerLng: 112.44036, centerLat: 23.635405, bbox: [112.06314, 23.369737, 112.74267, 23.976984], zoom: 11, sortOrder: 3 },
  { cityId: 'zhaoqing', id: 'zhaoqing-huaiji', name: '怀集县', centerLng: 112.166908, centerLat: 23.920806, bbox: [111.875706, 23.475329, 112.51616, 24.389386], zoom: 11, sortOrder: 4 },
  { cityId: 'zhaoqing', id: 'zhaoqing-fengkai', name: '封开县', centerLng: 111.512468, centerLat: 23.424267, bbox: [111.375075, 23.215444, 112.033495, 23.973414], zoom: 11, sortOrder: 5 },
  { cityId: 'zhaoqing', id: 'zhaoqing-deqing', name: '德庆县', centerLng: 111.785544, centerLat: 23.145035, bbox: [111.550381, 23.073658, 112.269213, 23.50746], zoom: 11, sortOrder: 6 },
  { cityId: 'zhaoqing', id: 'zhaoqing-sihui', name: '四会市', centerLng: 112.734309, centerLat: 23.326991, bbox: [112.429473, 23.217714, 112.88328, 23.687205], zoom: 11, sortOrder: 7 },
];
