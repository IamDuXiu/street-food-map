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

/**
 * 北京 / 上海 / 杭州行政区种子。
 * 数据来源同珠三角：腾讯 `district/v1/getchildren`（get_polygon=1），GCJ-02，2026-09-19。
 */
export const NATIONAL_CITY_DISTRICTS: DistrictSeed[] = [
  { cityId: 'beijing', id: 'beijing-dongcheng', name: '东城区', centerLng: 116.416334, centerLat: 39.928359, bbox: [116.380586, 39.871146, 116.446838, 39.960923], zoom: 11, sortOrder: 0 },
  { cityId: 'beijing', id: 'beijing-xicheng', name: '西城区', centerLng: 116.36585, centerLat: 39.9126, bbox: [116.321029, 39.871146, 116.387663, 39.972719], zoom: 11, sortOrder: 1 },
  { cityId: 'beijing', id: 'beijing-chaoyang', name: '朝阳区', centerLng: 116.443136, centerLat: 39.921444, bbox: [116.350883, 39.82497, 116.643852, 40.090186], zoom: 11, sortOrder: 2 },
  { cityId: 'beijing', id: 'beijing-fengtai', name: '丰台区', centerLng: 116.286726, centerLat: 39.858538, bbox: [116.054644, 39.761623, 116.44364, 39.897094], zoom: 11, sortOrder: 3 },
  { cityId: 'beijing', id: 'beijing-shijingshan', name: '石景山区', centerLng: 116.223015, centerLat: 39.906304, bbox: [116.111949, 39.888758, 116.259091, 39.993438], zoom: 11, sortOrder: 4 },
  { cityId: 'beijing', id: 'beijing-haidian', name: '海淀区', centerLng: 116.2977, centerLat: 39.959893, bbox: [116.048873, 39.896666, 116.390646, 40.160985], zoom: 11, sortOrder: 5 },
  { cityId: 'beijing', id: 'beijing-mentougou', name: '门头沟区', centerLng: 116.101668, centerLat: 39.940842, bbox: [115.426773, 39.813306, 116.167029, 40.177573], zoom: 11, sortOrder: 6 },
  { cityId: 'beijing', id: 'beijing-fangshan', name: '房山区', centerLng: 116.143426, centerLat: 39.748889, bbox: [115.424842, 39.50705, 116.251527, 39.925238], zoom: 11, sortOrder: 7 },
  { cityId: 'beijing', id: 'beijing-tongzhou', name: '通州区', centerLng: 116.72923, centerLat: 39.916403, bbox: [116.527333, 39.615914, 116.953804, 40.017516], zoom: 11, sortOrder: 8 },
  { cityId: 'beijing', id: 'beijing-shunyi', name: '顺义区', centerLng: 116.661474, centerLat: 40.149891, bbox: [116.466839, 40.014474, 116.96193, 40.311202], zoom: 11, sortOrder: 9 },
  { cityId: 'beijing', id: 'beijing-changping', name: '昌平区', centerLng: 116.231034, centerLat: 40.220952, bbox: [115.85334, 40.041273, 116.505936, 40.391678], zoom: 11, sortOrder: 10 },
  { cityId: 'beijing', id: 'beijing-daxing', name: '大兴区', centerLng: 116.341483, centerLat: 39.726917, bbox: [116.221175, 39.453311, 116.725524, 39.831896], zoom: 11, sortOrder: 11 },
  { cityId: 'beijing', id: 'beijing-huairou', name: '怀柔区', centerLng: 116.631974, centerLat: 40.317003, bbox: [116.289879, 40.233676, 116.886972, 41.060798], zoom: 11, sortOrder: 12 },
  { cityId: 'beijing', id: 'beijing-pinggu', name: '平谷区', centerLng: 117.121589, centerLat: 40.140805, bbox: [116.935209, 40.029635, 117.390024, 40.375541], zoom: 11, sortOrder: 13 },
  { cityId: 'beijing', id: 'beijing-miyun', name: '密云区', centerLng: 116.843351, centerLat: 40.377058, bbox: [116.665803, 40.229843, 117.505754, 40.80107], zoom: 11, sortOrder: 14 },
  { cityId: 'beijing', id: 'beijing-yanqing', name: '延庆区', centerLng: 115.974609, centerLat: 40.457033, bbox: [115.739703, 40.265611, 116.573913, 40.791805], zoom: 11, sortOrder: 15 },
  { cityId: 'shanghai', id: 'shanghai-huangpu', name: '黄浦区', centerLng: 121.48442, centerLat: 31.231661, bbox: [121.457748, 31.190235, 121.495032, 31.242363], zoom: 11, sortOrder: 0 },
  { cityId: 'shanghai', id: 'shanghai-xuhui', name: '徐汇区', centerLng: 121.436307, centerLat: 31.188334, bbox: [121.396968, 31.112252, 121.474866, 31.220177], zoom: 11, sortOrder: 1 },
  { cityId: 'shanghai', id: 'shanghai-changning', name: '长宁区', centerLng: 121.424696, centerLat: 31.220557, bbox: [121.338139, 31.182833, 121.439407, 31.23751], zoom: 11, sortOrder: 2 },
  { cityId: 'shanghai', id: 'shanghai-jingan', name: '静安区', centerLng: 121.447348, centerLat: 31.227718, bbox: [121.425119, 31.214259, 121.48312, 31.315972], zoom: 11, sortOrder: 3 },
  { cityId: 'shanghai', id: 'shanghai-putuo', name: '普陀区', centerLng: 121.39547, centerLat: 31.249618, bbox: [121.336072, 31.229291, 121.427524, 31.294789], zoom: 11, sortOrder: 4 },
  { cityId: 'shanghai', id: 'shanghai-hongkou', name: '虹口区', centerLng: 121.504994, centerLat: 31.264917, bbox: [121.468408, 31.241989, 121.516541, 31.315972], zoom: 11, sortOrder: 5 },
  { cityId: 'shanghai', id: 'shanghai-yangpu', name: '杨浦区', centerLng: 121.525409, centerLat: 31.259588, bbox: [121.485463, 31.247128, 121.569261, 31.346804], zoom: 11, sortOrder: 6 },
  { cityId: 'shanghai', id: 'shanghai-minhang', name: '闵行区', centerLng: 121.380857, centerLat: 31.112834, bbox: [121.239946, 30.975863, 121.575689, 31.25947], zoom: 11, sortOrder: 7 },
  { cityId: 'shanghai', id: 'shanghai-baoshan', name: '宝山区', centerLng: 121.489431, centerLat: 31.405242, bbox: [121.300861, 31.270711, 121.525543, 31.508696], zoom: 11, sortOrder: 8 },
  { cityId: 'shanghai', id: 'shanghai-jiading', name: '嘉定区', centerLng: 121.265276, centerLat: 31.375566, bbox: [121.106755, 31.230748, 121.380885, 31.496749], zoom: 11, sortOrder: 9 },
  { cityId: 'shanghai', id: 'shanghai-pudong', name: '浦东新区', centerLng: 121.544346, centerLat: 31.221461, bbox: [121.457043, 30.845671, 122.020965, 31.388883], zoom: 11, sortOrder: 10 },
  { cityId: 'shanghai', id: 'shanghai-jinshan', name: '金山区', centerLng: 121.341774, centerLat: 30.742769, bbox: [120.996495, 30.68824, 121.463344, 30.95024], zoom: 11, sortOrder: 11 },
  { cityId: 'shanghai', id: 'shanghai-songjiang', name: '松江区', centerLng: 121.227676, centerLat: 31.03257, bbox: [121.028678, 30.897549, 121.371903, 31.157992], zoom: 11, sortOrder: 12 },
  { cityId: 'shanghai', id: 'shanghai-qingpu', name: '青浦区', centerLng: 121.124249, centerLat: 31.15098, bbox: [120.856856, 30.943726, 121.319264, 31.276495], zoom: 11, sortOrder: 13 },
  { cityId: 'shanghai', id: 'shanghai-fengxian', name: '奉贤区', centerLng: 121.473945, centerLat: 30.918406, bbox: [121.351562, 30.779252, 121.76886, 31.005664], zoom: 11, sortOrder: 14 },
  { cityId: 'shanghai', id: 'shanghai-chongming', name: '崇明区', centerLng: 121.397662, centerLat: 31.623863, bbox: [121.165972, 31.147035, 122.117996, 31.871578], zoom: 11, sortOrder: 15 },
  { cityId: 'hangzhou', id: 'hangzhou-shangcheng', name: '上城区', centerLng: 120.19732, centerLat: 30.226543, bbox: [120.139327, 30.19261, 120.293822, 30.392716], zoom: 11, sortOrder: 0 },
  { cityId: 'hangzhou', id: 'hangzhou-gongshu', name: '拱墅区', centerLng: 120.141503, centerLat: 30.319126, bbox: [120.085813, 30.257963, 120.218918, 30.386203], zoom: 11, sortOrder: 1 },
  { cityId: 'hangzhou', id: 'hangzhou-xihu', name: '西湖区', centerLng: 120.130396, centerLat: 30.259242, bbox: [119.996339, 30.088668, 120.183006, 30.348357], zoom: 11, sortOrder: 2 },
  { cityId: 'hangzhou', id: 'hangzhou-binjiang', name: '滨江区', centerLng: 120.211981, centerLat: 30.208332, bbox: [120.139327, 30.137247, 120.234638, 30.237666], zoom: 11, sortOrder: 3 },
  { cityId: 'hangzhou', id: 'hangzhou-xiaoshan', name: '萧山区', centerLng: 120.264263, centerLat: 30.184119, bbox: [120.077128, 29.845968, 120.704457, 30.29755], zoom: 11, sortOrder: 4 },
  { cityId: 'hangzhou', id: 'hangzhou-yuhang', name: '余杭区', centerLng: 119.978742, centerLat: 30.273705, bbox: [119.68109, 30.174928, 120.151054, 30.558539], zoom: 11, sortOrder: 5 },
  { cityId: 'hangzhou', id: 'hangzhou-fuyang', name: '富阳区', centerLng: 119.960255, centerLat: 30.04879, bbox: [119.440088, 29.763244, 120.146877, 30.196953], zoom: 11, sortOrder: 6 },
  { cityId: 'hangzhou', id: 'hangzhou-linan', name: '临安区', centerLng: 119.724446, centerLat: 30.234355, bbox: [118.846805, 29.950973, 119.864747, 30.443375], zoom: 11, sortOrder: 7 },
  { cityId: 'hangzhou', id: 'hangzhou-linping', name: '临平区', centerLng: 120.299222, centerLat: 30.419154, bbox: [120.127677, 30.315075, 120.34434, 30.519818], zoom: 11, sortOrder: 8 },
  { cityId: 'hangzhou', id: 'hangzhou-qiantang', name: '钱塘区', centerLng: 120.493876, centerLat: 30.32287, bbox: [120.293338, 30.23078, 120.699579, 30.384733], zoom: 11, sortOrder: 9 },
  { cityId: 'hangzhou', id: 'hangzhou-tonglu', name: '桐庐县', centerLng: 119.691755, centerLat: 29.79418, bbox: [119.18212, 29.58764, 119.973108, 30.087197], zoom: 11, sortOrder: 10 },
  { cityId: 'hangzhou', id: 'hangzhou-chunan', name: '淳安县', centerLng: 119.042015, centerLat: 29.609678, bbox: [118.344969, 29.193098, 119.348291, 30.035083], zoom: 11, sortOrder: 11 },
  { cityId: 'hangzhou', id: 'hangzhou-jiande', name: '建德市', centerLng: 119.281195, centerLat: 29.474964, bbox: [118.900435, 29.205193, 119.765301, 29.770956], zoom: 11, sortOrder: 12 },
];
