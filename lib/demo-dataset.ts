/**
 * 全国 5 城演示数据（`SEED_DEMO=1` 时写入）。
 *
 * 定位：让刚部署完的人**一眼看懂这个产品在做什么**——地图上真的有店、每份饭都有价格
 * 与核验日期、可信度分级看得出来、超过 180 天的价格会消失。
 *
 * 三条自我约束（改数据时必须保持）：
 * 1. **不是真实店铺**。店名是通用描述式命名，地址统一带「（演示数据）」，创作者来源用
 *    `示例创作者-*` + `example.com` 链接；公开站点上另有全局演示提示。
 * 2. **坐标由区域中心推导**，不是手抄的假精度：写入时按 `centerLng/centerLat` + 固定
 *    网格偏移落点，保证落在该行政区 bbox 内（覆盖状态才会亮），见
 *    `lib/server/seed.ts` 的 `seedNationalDemo`。
 * 3. **核验日期相对「写入时刻」**（`daysAgo`），否则部署得越晚，演示数据越早过期消失。
 *
 * 每个城市固定 9 家：6 家常规核验门店、1 家创作者来源（未核验）、1 家只有 >¥15 餐食
 * （店级门槛不通过 → 不公开）、1 家只有 180 天前的价格（新鲜度不通过 → 不公开）。
 * 这样「收录规则」和「不收录的样子」都能在演示里看到。
 */

export type DemoVerificationMethod =
  | 'onsite_menu'
  | 'receipt'
  | 'official_menu'
  | 'community_confirmed'
  | 'external_lead';

export interface DemoMeal {
  name: string;
  /** 单位：元（写入时换算成分）。 */
  priceYuan: number;
  category: string;
  description: string;
  /** 核验日期 = 写入时刻往前推这么多天。 */
  daysAgo: number;
  method: DemoVerificationMethod;
}

export interface DemoPlace {
  /** 用于生成稳定 id：`demo-place-<slug>`。 */
  slug: string;
  name: string;
  address: string;
  category: string;
  /** 展示用准入说明；含「公开」则记为 public。 */
  access: string;
  tags: string[];
  note: string;
  meals: DemoMeal[];
  /** 只有未核验的创作者来源价时填写（用于演示「未核验 · 创作者来源」）。 */
  creatorSource?: {
    platform: 'bilibili' | 'youtube' | 'web';
    creatorName: string;
    contentUrl: string;
  };
}

export interface DemoArea {
  /** 片区 id：`demo-<city>-<slug>`；同时是本实例「含演示数据」的标记。 */
  id: string;
  /** 展示在门店卡片上的片区名。 */
  name: string;
  city: string;
  /** 该片区所属行政区 id（用于校验坐标落在对应 bbox 内）。 */
  districtId: string;
  audience: 'student' | 'office_worker';
  centerLng: number;
  centerLat: number;
  places: DemoPlace[];
}

export const DEMO_AREAS: DemoArea[] = [
  // ── 北京 ────────────────────────────────────────────────────────────
  {
    id: 'demo-beijing-zhongguancun',
    name: '中关村',
    city: 'beijing',
    districtId: 'beijing-haidian',
    audience: 'office_worker',
    centerLng: 116.316,
    centerLat: 39.983,
    places: [
      {
        slug: 'bj-zha-jiang-mian',
        name: '巷口炸酱面',
        address: '中关村南大街附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['分量足', '可打包'],
        note: '工作日中午 11:30 前人少，面码可免费加一次。',
        meals: [
          { name: '炸酱面', priceYuan: 13, category: '粉面', description: '手擀面，黄瓜丝与豆芽各一份', daysAgo: 12, method: 'onsite_menu' },
          { name: '卤蛋', priceYuan: 3, category: '小吃', description: '单独计价，可加面里', daysAgo: 12, method: 'receipt' },
        ],
      },
      {
        slug: 'bj-bailing-canteen',
        name: '中关村白领食堂',
        address: '知春路附近（演示数据）',
        category: '园区食堂',
        access: '需园区卡 / 访客登记',
        tags: ['有肉有菜', '园区食堂', '可打包'],
        note: '两荤一素是门口价目表上的最低套餐，其余餐食如实标价。',
        meals: [
          { name: '两荤一素自选饭', priceYuan: 15, category: '米饭', description: '三格餐盘，米饭免费续一次', daysAgo: 20, method: 'onsite_menu' },
          { name: '小炒肉盖饭', priceYuan: 18, category: '盖饭', description: '现炒小炒肉，配米饭与例汤', daysAgo: 20, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'bj-night-noodle',
        name: '中关村深夜拌面',
        address: '苏州街附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['夜宵', '分量足'],
        note: '只做 17:00 之后，最后一锅面通常 23:30 收。',
        meals: [
          { name: '麻酱拌面', priceYuan: 12, category: '粉面', description: '麻酱 + 黄瓜丝，可选加卤蛋', daysAgo: 6, method: 'external_lead' },
        ],
        creatorSource: {
          platform: 'bilibili',
          creatorName: '示例创作者-北京',
          contentUrl: 'https://example.com/demo/creator-beijing',
        },
      },
    ],
  },
  {
    id: 'demo-beijing-wudaokou',
    name: '五道口',
    city: 'beijing',
    districtId: 'beijing-haidian',
    audience: 'student',
    centerLng: 116.337,
    centerLat: 39.993,
    places: [
      {
        slug: 'bj-wudaokou-dumpling',
        name: '五道口饺子馆',
        address: '成府路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['分量足', '可打包'],
        note: '12 只一份，两种馅都按同一价钱，可以拼一半一半。',
        meals: [
          { name: '白菜猪肉饺（12 只）', priceYuan: 12, category: '小吃', description: '现包现煮，配醋与蒜汁', daysAgo: 8, method: 'onsite_menu' },
          { name: '韭菜鸡蛋饺（12 只）', priceYuan: 12, category: '小吃', description: '素馅同价', daysAgo: 8, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'bj-xueyuanlu-mala',
        name: '学院路麻辣烫',
        address: '学院路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['有肉有菜', '夜宵'],
        note: '小份是标准一人份，称重档口旁边有明细价签。',
        meals: [
          { name: '麻辣烫小份', priceYuan: 14, category: '小吃', description: '含两种荤菜，米饭另计', daysAgo: 15, method: 'receipt' },
        ],
      },
      {
        slug: 'bj-zhongguancun-xiaochao',
        name: '知春小炒',
        address: '知春里附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '店里最便宜的是一份 22 元的盖饭，没有 15 元以内的单人餐。',
        meals: [
          { name: '干锅土豆片盖饭', priceYuan: 22, category: '盖饭', description: '现炒，配免费例汤', daysAgo: 30, method: 'onsite_menu' },
        ],
      },
    ],
  },
  {
    id: 'demo-beijing-guomao',
    name: '国贸',
    city: 'beijing',
    districtId: 'beijing-chaoyang',
    audience: 'office_worker',
    centerLng: 116.461,
    centerLat: 39.909,
    places: [
      {
        slug: 'bj-guomao-basement',
        name: '国贸地下快餐',
        address: '建国门外大街附近（演示数据）',
        category: '园区食堂',
        access: '公开可进',
        tags: ['有肉有菜', '可打包'],
        note: '地下美食城最里侧那家，12:00–13:00 排队最长。',
        meals: [
          { name: '咖喱鸡饭', priceYuan: 15, category: '盖饭', description: '配土豆胡萝卜，米饭可加', daysAgo: 5, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'bj-jianwai-noodle',
        name: '建外牛肉面',
        address: '建外大街附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['分量足', '早餐'],
        note: '早餐 7:00 开门，面和小菜分开计价。',
        meals: [
          { name: '牛肉面', priceYuan: 13, category: '粉面', description: '清汤，可加辣', daysAgo: 5, method: 'onsite_menu' },
          { name: '爽口小菜', priceYuan: 4, category: '小吃', description: '当日现拌', daysAgo: 5, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'bj-hujialou-roast',
        name: '呼家楼烧腊档',
        address: '呼家楼附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '最后一次看到价签是两百天前，之后没人再确认，地图上已隐去。',
        meals: [
          { name: '烧鸭饭', priceYuan: 24, category: '米饭', description: '配青菜与卤汁', daysAgo: 200, method: 'onsite_menu' },
        ],
      },
    ],
  },

  // ── 上海 ────────────────────────────────────────────────────────────
  {
    id: 'demo-shanghai-jingansi',
    name: '静安寺',
    city: 'shanghai',
    districtId: 'shanghai-jingan',
    audience: 'office_worker',
    centerLng: 121.447,
    centerLat: 31.228,
    places: [
      {
        slug: 'sh-nongtang-huntun',
        name: '弄堂小馄饨',
        address: '愚园路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐', '分量足'],
        note: '早上只卖馄饨，加辣油不加价。',
        meals: [
          { name: '小馄饨', priceYuan: 12, category: '小吃', description: '一碗 12 只，配蛋皮与紫菜', daysAgo: 9, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sh-jingan-noodle',
        name: '静安本帮面馆',
        address: '南京西路附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['有肉有菜', '可打包'],
        note: '浇头可以单独点，素浇头比辣肉便宜两块。',
        meals: [
          { name: '辣肉面', priceYuan: 14, category: '粉面', description: '辣肉浇头 + 汤面', daysAgo: 18, method: 'onsite_menu' },
          { name: '素鸡面', priceYuan: 12, category: '粉面', description: '素浇头，汤头同款', daysAgo: 18, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sh-jingan-bancai',
        name: '静安深夜拌川',
        address: '武定路附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['夜宵'],
        note: '夜里 10 点后才出摊，只收现金与扫码。',
        meals: [
          { name: '拌川', priceYuan: 13, category: '粉面', description: '现炒浇头盖在粗面上', daysAgo: 4, method: 'external_lead' },
        ],
        creatorSource: {
          platform: 'bilibili',
          creatorName: '示例创作者-上海',
          contentUrl: 'https://example.com/demo/creator-shanghai',
        },
      },
    ],
  },
  {
    id: 'demo-shanghai-xujiahui',
    name: '徐家汇',
    city: 'shanghai',
    districtId: 'shanghai-xuhui',
    audience: 'office_worker',
    centerLng: 121.436,
    centerLat: 31.188,
    places: [
      {
        slug: 'sh-xujiahui-tangbao',
        name: '徐家汇汤包铺',
        address: '宛平路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐', '分量足'],
        note: '一两 8 只，早餐时段分量最足。',
        meals: [
          { name: '鲜肉汤包（8 只）', priceYuan: 13, category: '小吃', description: '现包现蒸，配姜丝醋', daysAgo: 11, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sh-caohejing-canteen',
        name: '漕河泾园区食堂',
        address: '宜山路附近（演示数据）',
        category: '园区食堂',
        access: '需园区卡',
        tags: ['有肉有菜', '园区食堂', '可打包'],
        note: '两菜一汤是价目表最低档，三菜一汤加 7 元。',
        meals: [
          { name: '两菜一汤', priceYuan: 15, category: '米饭', description: '自选两格菜，例汤免费', daysAgo: 22, method: 'onsite_menu' },
          { name: '三菜一汤', priceYuan: 22, category: '米饭', description: '自选三格菜', daysAgo: 22, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sh-xuhui-bistro',
        name: '徐汇小馆',
        address: '衡山路附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '菜单上最低是 26 元的盖饭，属于不符合店级门槛的样子。',
        meals: [
          { name: '红烧肉盖饭', priceYuan: 26, category: '盖饭', description: '配青菜与卤蛋', daysAgo: 40, method: 'official_menu' },
        ],
      },
    ],
  },
  {
    id: 'demo-shanghai-lujiazui',
    name: '陆家嘴',
    city: 'shanghai',
    districtId: 'shanghai-pudong',
    audience: 'office_worker',
    centerLng: 121.544,
    centerLat: 31.221,
    places: [
      {
        slug: 'sh-lujiazui-canteen',
        name: '陆家嘴白领食堂',
        address: '世纪大道附近（演示数据）',
        category: '园区食堂',
        access: '公开可进',
        tags: ['有肉有菜', '园区食堂'],
        note: '一荤两素是最便宜的档，工作日 11:20 前不用排队。',
        meals: [
          { name: '一荤两素套餐', priceYuan: 15, category: '米饭', description: '含米饭与例汤', daysAgo: 3, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sh-pudong-paigu',
        name: '浦东排骨年糕',
        address: '浦东南路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['分量足', '可打包'],
        note: '排骨单独炸，年糕吸汁，小票上有分项价格。',
        meals: [
          { name: '排骨年糕', priceYuan: 14, category: '小吃', description: '一块排骨 + 两条年糕', daysAgo: 7, method: 'receipt' },
        ],
      },
      {
        slug: 'sh-lujiazui-tangbao',
        name: '陆家嘴汤包馆',
        address: '东方路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐'],
        note: '蟹粉汤包是唯一在售品类，两百多天前的价格，已过期。',
        meals: [
          { name: '蟹粉汤包（6 只）', priceYuan: 38, category: '小吃', description: '当季供应', daysAgo: 210, method: 'onsite_menu' },
        ],
      },
    ],
  },

  // ── 广州 ────────────────────────────────────────────────────────────
  {
    id: 'demo-guangzhou-tiyuxi',
    name: '体育西路',
    city: 'guangzhou',
    districtId: 'guangzhou-tianhe',
    audience: 'office_worker',
    centerLng: 113.322,
    centerLat: 23.132,
    places: [
      {
        slug: 'gz-tianhe-roast',
        name: '天河烧腊档',
        address: '体育西路附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜', '分量足'],
        note: '叉烧饭是招牌，例汤单独计价也可以只点饭。',
        meals: [
          { name: '叉烧饭', priceYuan: 15, category: '米饭', description: '现斩叉烧，配青菜与卤汁', daysAgo: 10, method: 'onsite_menu' },
          { name: '例汤', priceYuan: 5, category: '小吃', description: '当日炖汤，单独一碗', daysAgo: 10, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'gz-tiyuxi-sweet',
        name: '体育西糖水铺',
        address: '天河南一路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['夜宵'],
        note: '晚上九点后小份糖水会打折，价格以小票为准。',
        meals: [
          { name: '双皮奶', priceYuan: 9, category: '小吃', description: '冻或热，加红豆另计', daysAgo: 10, method: 'receipt' },
        ],
      },
      {
        slug: 'gz-tianhe-changfen',
        name: '天河深夜肠粉',
        address: '六运小区附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐', '夜宵'],
        note: '凌晨两点前都在，斋肠是摊上最便宜的一份。',
        meals: [
          { name: '斋肠粉', priceYuan: 7, category: '小吃', description: '现蒸米浆，配豉油', daysAgo: 3, method: 'external_lead' },
        ],
        creatorSource: {
          platform: 'bilibili',
          creatorName: '示例创作者-广州',
          contentUrl: 'https://example.com/demo/creator-guangzhou',
        },
      },
    ],
  },
  {
    id: 'demo-guangzhou-gongyuanqian',
    name: '公园前',
    city: 'guangzhou',
    districtId: 'guangzhou-yuexiu',
    audience: 'office_worker',
    centerLng: 113.267,
    centerLat: 23.128,
    places: [
      {
        slug: 'gz-xiguan-changfen',
        name: '西关肠粉铺',
        address: '中山六路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐', '分量足'],
        note: '牛肉肠粉是现拉，早上七点开门。',
        meals: [
          { name: '牛肉肠粉', priceYuan: 12, category: '小吃', description: '两份米浆，牛肉现切', daysAgo: 14, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'gz-yuexiu-noodle',
        name: '越秀竹升面',
        address: '北京路附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['有肉有菜', '分量足'],
        note: '云吞面比牛腩面便宜两块，两款都是全份量。',
        meals: [
          { name: '牛腩竹升面', priceYuan: 15, category: '粉面', description: '竹升面配牛腩四块', daysAgo: 14, method: 'onsite_menu' },
          { name: '云吞面', priceYuan: 13, category: '粉面', description: '鲜虾云吞五只', daysAgo: 14, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'gz-huifu-stew',
        name: '惠福东路炖品',
        address: '惠福东路附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '炖汤配饭套餐 23 元，没有更便宜的单人餐。',
        meals: [
          { name: '原盅炖汤饭', priceYuan: 23, category: '米饭', description: '一盅炖汤 + 白饭', daysAgo: 45, method: 'onsite_menu' },
        ],
      },
    ],
  },
  {
    id: 'demo-guangzhou-jiangnanxi',
    name: '江南西',
    city: 'guangzhou',
    districtId: 'guangzhou-haizhu',
    audience: 'office_worker',
    centerLng: 113.317,
    centerLat: 23.084,
    places: [
      {
        slug: 'gz-haizhu-baozai',
        name: '海珠煲仔饭',
        address: '江南大道中附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜', '分量足'],
        note: '腊味煲仔饭是午市主推，锅巴可以要求多留。',
        meals: [
          { name: '腊味煲仔饭', priceYuan: 15, category: '米饭', description: '腊肠腊肉双拼，配青菜', daysAgo: 6, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'gz-jiangnanxi-soup',
        name: '江南西炖汤铺',
        address: '青竹大街附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '炖汤加米饭算一份，汤可以单独买。',
        meals: [
          { name: '炖汤 + 米饭', priceYuan: 14, category: '米饭', description: '当日炖汤，米饭一小碗', daysAgo: 6, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'gz-haizhu-cha',
        name: '海珠茶餐厅',
        address: '宝岗大道附近（演示数据）',
        category: '茶餐厅',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '只记过一次价，之后半年多没人再确认，已从地图隐去。',
        meals: [
          { name: '干炒牛河', priceYuan: 28, category: '粉面', description: '镬气足，配豆芽', daysAgo: 190, method: 'onsite_menu' },
        ],
      },
    ],
  },

  // ── 深圳（南山样板区由既有演示数据覆盖，这里补罗湖与宝安）──────────────
  {
    id: 'demo-shenzhen-luohu',
    name: '罗湖国贸',
    city: 'shenzhen',
    districtId: 'luohu',
    audience: 'office_worker',
    centerLng: 114.101,
    centerLat: 22.525,
    places: [
      {
        slug: 'sz-luohu-kwayteow',
        name: '罗湖潮汕粿条',
        address: '人民南路附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['有肉有菜', '分量足'],
        note: '汤粿与干粿同价，牛肉丸可以单加。',
        meals: [
          { name: '牛肉粿条', priceYuan: 15, category: '粉面', description: '现切牛肉，配沙茶酱', daysAgo: 7, method: 'onsite_menu' },
          { name: '粿条汤', priceYuan: 12, category: '粉面', description: '清汤版，不加肉', daysAgo: 7, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sz-dongmen-sweet',
        name: '东门糖水铺',
        address: '东门中路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['夜宵'],
        note: '夜里十点后还开，龟苓膏按小份计价。',
        meals: [
          { name: '龟苓膏（小份）', priceYuan: 8, category: '小吃', description: '配蜂蜜或炼乳', daysAgo: 7, method: 'receipt' },
        ],
      },
      {
        slug: 'sz-luohu-changfen',
        name: '罗湖深夜肠粉',
        address: '湖贝路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐', '夜宵'],
        note: '夜里出摊，鸡蛋肠是最便宜的一份。',
        meals: [
          { name: '鸡蛋肠粉', priceYuan: 8, category: '小吃', description: '现蒸，配豉油与辣椒', daysAgo: 5, method: 'external_lead' },
        ],
        creatorSource: {
          platform: 'bilibili',
          creatorName: '示例创作者-深圳',
          contentUrl: 'https://example.com/demo/creator-shenzhen',
        },
      },
    ],
  },
  {
    id: 'demo-shenzhen-xinan',
    name: '宝安新安',
    city: 'shenzhen',
    districtId: 'baoan',
    audience: 'office_worker',
    centerLng: 113.887,
    centerLat: 22.553,
    places: [
      {
        slug: 'sz-baoan-yanmian',
        name: '宝安客家腌面',
        address: '新安街道附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['早餐', '分量足'],
        note: '腌面配一碗猪杂汤，早餐时段最快。',
        meals: [
          { name: '腌面 + 汤', priceYuan: 13, category: '粉面', description: '腌面一份，配猪杂汤', daysAgo: 13, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sz-xinan-fastfood',
        name: '新安快餐档',
        address: '前进一路附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜', '可打包'],
        note: '一荤两素是档口最低价，两荤一素加五块。',
        meals: [
          { name: '一荤两素', priceYuan: 15, category: '米饭', description: '自选一荤两素，米饭可加', daysAgo: 13, method: 'onsite_menu' },
          { name: '两荤一素', priceYuan: 20, category: '米饭', description: '同日价目表另一档', daysAgo: 13, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sz-baoan-changfen',
        name: '宝安肠粉王',
        address: '宝城附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐'],
        note: '最便宜的一份 19 元，门店不符合店级门槛。',
        meals: [
          { name: '肉蛋肠粉', priceYuan: 19, category: '小吃', description: '加肉加蛋，双份米浆', daysAgo: 50, method: 'onsite_menu' },
        ],
      },
    ],
  },
  {
    id: 'demo-shenzhen-xixiang',
    name: '西乡',
    city: 'shenzhen',
    districtId: 'baoan',
    audience: 'office_worker',
    centerLng: 113.841,
    centerLat: 22.56,
    places: [
      {
        slug: 'sz-xixiang-roast',
        name: '西乡烧腊饭',
        address: '西乡街道附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '烧肉饭固定价，配汤免费。',
        meals: [
          { name: '烧肉饭', priceYuan: 15, category: '米饭', description: '脆皮烧肉，配青菜', daysAgo: 4, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'sz-xixiang-sweet',
        name: '西乡糖水店',
        address: '流塘附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['夜宵', '可打包'],
        note: '芝麻糊按碗计价，打包不加钱。',
        meals: [
          { name: '芝麻糊', priceYuan: 7, category: '小吃', description: '现磨，热食', daysAgo: 4, method: 'receipt' },
        ],
      },
      {
        slug: 'sz-xixiang-cha',
        name: '西乡茶餐厅',
        address: '固戍附近（演示数据）',
        category: '茶餐厅',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '焗猪扒饭记过一次价，超过 180 天没再确认。',
        meals: [
          { name: '焗猪扒饭', priceYuan: 30, category: '盖饭', description: '配罗宋汤', daysAgo: 185, method: 'onsite_menu' },
        ],
      },
    ],
  },

  // ── 杭州 ────────────────────────────────────────────────────────────
  {
    id: 'demo-hangzhou-wensanlu',
    name: '文三路',
    city: 'hangzhou',
    districtId: 'hangzhou-xihu',
    audience: 'office_worker',
    centerLng: 120.13,
    centerLat: 30.259,
    places: [
      {
        slug: 'hz-pianerchuan',
        name: '西湖片儿川面馆',
        address: '文三路附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['分量足', '早餐'],
        note: '片儿川是店里最便宜的一份，雪菜可以加量。',
        meals: [
          { name: '片儿川', priceYuan: 14, category: '粉面', description: '笋片雪菜肉片，配一碗面汤', daysAgo: 16, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'hz-wensanlu-bancai',
        name: '文三路拌川摊',
        address: '古荡附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['夜宵'],
        note: '现炒浇头，小票上分列面与浇头价格。',
        meals: [
          { name: '拌川', priceYuan: 12, category: '粉面', description: '粗面配现炒浇头', daysAgo: 16, method: 'receipt' },
        ],
      },
      {
        slug: 'hz-wensanlu-night',
        name: '文三路深夜面',
        address: '翠苑附近（演示数据）',
        category: '面馆',
        access: '公开可进',
        tags: ['夜宵', '分量足'],
        note: '只做夜里，猪肝面是招牌。',
        meals: [
          { name: '猪肝面', priceYuan: 15, category: '粉面', description: '现炒猪肝，面可加', daysAgo: 2, method: 'external_lead' },
        ],
        creatorSource: {
          platform: 'bilibili',
          creatorName: '示例创作者-杭州',
          contentUrl: 'https://example.com/demo/creator-hangzhou',
        },
      },
    ],
  },
  {
    id: 'demo-hangzhou-wulin',
    name: '武林',
    city: 'hangzhou',
    districtId: 'hangzhou-gongshu',
    audience: 'office_worker',
    centerLng: 120.142,
    centerLat: 30.319,
    places: [
      {
        slug: 'hz-wulin-xiaolong',
        name: '武林小笼铺',
        address: '体育场路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐', '分量足'],
        note: '一两 8 只，早市现蒸。',
        meals: [
          { name: '鲜肉小笼（8 只）', priceYuan: 13, category: '小吃', description: '配醋碟', daysAgo: 19, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'hz-gongshu-canteen',
        name: '拱墅社区食堂',
        address: '大关附近（演示数据）',
        category: '园区食堂',
        access: '公开可进',
        tags: ['有肉有菜', '园区食堂'],
        note: '一荤两素是基础档，大排面比套餐贵一元。',
        meals: [
          { name: '一荤两素', priceYuan: 15, category: '米饭', description: '含米饭与汤', daysAgo: 19, method: 'onsite_menu' },
          { name: '大排面', priceYuan: 16, category: '粉面', description: '面 + 一块大排', daysAgo: 19, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'hz-wulin-curry',
        name: '武林咖喱饭',
        address: '朝晖附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '只有咖喱类餐食，最低 24 元，不在店级门槛内。',
        meals: [
          { name: '咖喱牛肉饭', priceYuan: 24, category: '盖饭', description: '配土豆与胡萝卜', daysAgo: 55, method: 'onsite_menu' },
        ],
      },
    ],
  },
  {
    id: 'demo-hangzhou-qianjiang',
    name: '钱江新城',
    city: 'hangzhou',
    districtId: 'hangzhou-shangcheng',
    audience: 'office_worker',
    centerLng: 120.197,
    centerLat: 30.227,
    places: [
      {
        slug: 'hz-qianjiang-bancai',
        name: '钱江拌川摊',
        address: '庆春东路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['分量足', '可打包'],
        note: '肉丝拌川是摊上最常点的一份，可打包。',
        meals: [
          { name: '肉丝拌川', priceYuan: 13, category: '粉面', description: '现炒肉丝，配一碗汤', daysAgo: 9, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'hz-shangcheng-congbao',
        name: '上城葱包烩',
        address: '望江路附近（演示数据）',
        category: '小吃档口',
        access: '公开可进',
        tags: ['早餐'],
        note: '三只一份，抹甜面酱不加价。',
        meals: [
          { name: '葱包烩（3 只）', priceYuan: 9, category: '小吃', description: '现烤油条与葱段', daysAgo: 9, method: 'onsite_menu' },
        ],
      },
      {
        slug: 'hz-qianjiang-curry',
        name: '钱江咖喱饭',
        address: '四季青附近（演示数据）',
        category: '街边快餐',
        access: '公开可进',
        tags: ['有肉有菜'],
        note: '记录过一次价，已经两百天，地图上看不到了。',
        meals: [
          { name: '咖喱鸡排饭', priceYuan: 27, category: '盖饭', description: '配米饭与沙拉', daysAgo: 200, method: 'onsite_menu' },
        ],
      },
    ],
  },
];

/** 演示数据里出现的来源账号都是虚构的，链接统一指向 example.com。 */
export function isDemoCreatorSource(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('https://example.com/demo/');
}
