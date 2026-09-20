import type { MapViewport, Place, Tag } from './types';

export const VIEWPORTS: MapViewport[] = [
  { id: 'sz university', label: '深大粤海', subtitle: '学生样板区 · 约 1.5 km', centerLng: 113.933073, centerLat: 22.526639, bbox: [113.916, 22.514, 113.946, 22.539], zoom: 14, level: 'business_area', coverage: 'live' },
  { id: 'science park', label: '高新园 / 科兴', subtitle: '上班族样板区 · 2.8 km', centerLng: 113.945, centerLat: 22.54, bbox: [113.929, 22.522, 113.966, 22.554], zoom: 14, level: 'business_area', coverage: 'live' },
];

export const TAGS: Tag[] = ['有肉有菜', '分量足', '早餐', '夜宵', '可打包', '园区食堂', '学校食堂', '便利店'];

export const PLACES: Place[] = [
  {
    id: 'shenda-yuehai-canteen',
    zoneId: 'sz university',
    name: '深大粤海食堂 · 二楼',
    address: '深圳大学粤海校区西门旁，学生食堂二楼',
    lng: 113.933073,
    lat: 22.526639,
    category: '学校食堂',
    access: '需校园卡 / 校园码',
    tags: ['有肉有菜', '分量足', '学校食堂', '可打包'],
    note: '午餐 11:00–13:30 档口最齐；校外访客可由西门登记进入。',
    verification: '高可信',
    meals: [
      { id: 'shenda-lunch', name: '两荤一素自选饭', priceFen: 1500, category: '米饭', description: '自选三格，米饭免费续一次', observedAt: '2026-08-29', method: '现场菜单或价签', freshness: '近期核验' },
      { id: 'shenda-noodle', name: '番茄鸡蛋面', priceFen: 1200, category: '粉面', description: '现煮面，配青菜和鸡蛋', observedAt: '2026-08-29', method: '现场菜单或价签', freshness: '近期核验' },
    ],
  },
  {
    id: 'shenda-west-noodle',
    zoneId: 'sz university',
    name: '西门潮汕粿条',
    address: '南山区南海大道 3688 号深大西门外 80 米',
    lng: 113.92984,
    lat: 22.52782,
    category: '街边快餐',
    access: '公开可进',
    tags: ['有肉有菜', '可打包', '夜宵'],
    note: '汤底清爽，晚间加肉不加价；高峰期约 10 分钟出餐。',
    verification: '近期核验',
    meals: [
      { id: 'west-goutiao', name: '牛肉粿条汤', priceFen: 1500, category: '粉面', description: '牛肉片、牛筋丸、青菜', observedAt: '2026-08-27', method: '当次消费小票', freshness: '近期核验' },
      { id: 'west-pork', name: '卤肉饭', priceFen: 1600, category: '米饭', description: '卤肉、卤蛋、青菜', observedAt: '2026-08-27', method: '当次消费小票', freshness: '近期核验' },
    ],
  },
  {
    id: 'kexing-b1-foodcourt',
    zoneId: 'science park',
    name: '科兴科学园 · B1 员工餐厅',
    address: '科兴科学园 B1 层，A3 栋电梯旁',
    lng: 113.94563,
    lat: 22.54064,
    category: '园区食堂',
    access: '需园区访客码',
    tags: ['有肉有菜', '分量足', '园区食堂', '可打包'],
    note: '11:45 前选择多；访客从 A3 栋前台登记后可进入。',
    verification: '高可信',
    meals: [
      { id: 'kexing-set', name: '工作日三菜一汤套餐', priceFen: 1500, category: '套餐', description: '一荤两素 + 汤 + 米饭', observedAt: '2026-08-30', method: '商户官方公开菜单', freshness: '近期核验' },
      { id: 'kexing-rice', name: '烧腊双拼饭', priceFen: 2200, category: '米饭', description: '叉烧烧鸭双拼，配时蔬', observedAt: '2026-08-30', method: '商户官方公开菜单', freshness: '近期核验' },
    ],
  },
  {
    id: 'tencent-community-kitchen',
    zoneId: 'science park',
    name: '科技园社区食堂',
    address: '深圳湾科技生态园 9A 栋一楼东侧',
    lng: 113.9512,
    lat: 22.5349,
    category: '社区食堂',
    access: '公开可进',
    tags: ['有肉有菜', '早餐', '夜宵', '可打包'],
    note: '早上 7:30 开门，晚上 20:30 前仍有热饭。',
    verification: '近期核验',
    meals: [
      { id: 'community-breakfast', name: '鸡蛋肉酱拌面', priceFen: 1400, category: '早餐', description: '现拌面 + 卤蛋 + 豆浆', observedAt: '2026-08-25', method: '两名独立用户确认', freshness: '近期核验' },
      { id: 'community-dinner', name: '香菇滑鸡饭', priceFen: 1900, category: '米饭', description: '滑鸡、香菇、青菜、例汤', observedAt: '2026-08-25', method: '两名独立用户确认', freshness: '近期核验' },
    ],
  },
  {
    id: 'seven-eleven-tech-park',
    zoneId: 'science park',
    name: '便利蜂 · 高新南七路店',
    address: '高新南七道 16 号创维半导体设计大厦一楼',
    lng: 113.9412,
    lat: 22.5361,
    category: '便利店',
    access: '公开可进',
    tags: ['早餐', '便利店', '可打包'],
    note: '适合赶时间，饭团和热柜 8:00 后补货最全。',
    verification: '中高可信',
    meals: [
      { id: 'convenience-bento', name: '照烧鸡排便当', priceFen: 2300, category: '便利店套餐', description: '鸡排、玉子烧、西兰花、米饭', observedAt: '2026-08-21', method: '现场菜单或价签', freshness: '近期核验' },
      { id: 'convenience-onigiri', name: '金枪鱼饭团', priceFen: 900, category: '早餐', description: '独立包装，即取即走', observedAt: '2026-08-21', method: '现场菜单或价签', freshness: '近期核验' },
    ],
  },
];
