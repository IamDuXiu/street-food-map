# 新增一个城市 / 行政区 / 商圈

这是最可能有人想提 PR 的地方。整体只有两步：**改常量，重写目录**。难点不在代码，而在坐标与边界的**来源要可核实**。

> 前置：坐标一律 **GCJ-02**；城市级范围不得超出 `lib/cities.ts` 的 `NATIONAL_BOUNDS`；行政区必须落在所属城市的 bbox 内。

## 1. 城市定义 —— `lib/cities.ts`

在 `CITIES` 里加一条（`bbox` 为 `[西, 南, 东, 北]`）：

```ts
{
  id: 'nanjing',
  label: '南京',
  full: '南京市',
  aliases: ['南京', '金陵'],
  centerLng: 118.7969,
  centerLat: 32.0603,
  bbox: [118.36, 31.23, 119.24, 32.6],
  zoom: 10,
  public: true,        // 公开白名单
}
```

- `public: true` 才会出现在公开地图与城市选择器里；**顺序 = 选择器里的顺序**（`PUBLIC_CITY_IDS` 由 `public` 过滤而成）。
- `public: false` 表示「数据可以入库，但不公开」——这是给未开放城市留的口子，不要为了「看起来覆盖多」把没数据的城市设成公开。
- `aliases` 用于把采集/导入文本里的城市名归一化（「羊城」→ 广州）。

## 2. 行政区 —— `lib/region-districts.ts`

追加 `DistrictSeed`：

```ts
{ cityId: 'nanjing', id: 'nanjing-gulou', name: '鼓楼区', centerLng: 118.769, centerLat: 32.066, bbox: [118.72, 32.02, 118.82, 32.11], zoom: 11, sortOrder: 0 },
```

- `id` 约定：`<cityId>-<拼音>`（深圳是历史遗留的短 id，不要再新增那种形式）。
- `centerLng/centerLat` 用**官方行政区中心**；`bbox` 用官方边界的经纬度范围。
- 珠三角其余城市放在 `PEARL_RIVER_DISTRICTS`，5 个公开城市放在 `NATIONAL_CITY_DISTRICTS`。
- 直筒子市（东莞、中山）没有区级，只保留市级——不要硬造。

数据来源：腾讯地图 WebService `district/v1/getchildren`（`get_polygon=1`），**一次性生成后固化到本文件**，运行时不依赖腾讯接口。改完请在文件头的版本注记里写清楚来源与日期。

## 3. 商圈（可选）

只有深圳有商圈目录，见 `lib/regions.ts` 的 `SHENZHEN_REGION_CATALOG`。「覆盖状态」不需要手工维护：某商圈/行政区 bbox 内**有公开点位**就会自动显示「已有饭签」，否则显示「暂无饭签」。

## 4. 重写目录并自检

```bash
npm run seed:regions        # 幂等，把区域目录写进本地数据库
npm run lint && npm run typecheck && npm test && npm run build
```

- 目录写入后，用接口确认城市返回正常：`curl 'http://localhost:3000/api/v1/config?city=nanjing'`。
- 新增/调整行政区后，**数量断言要同步**：`tests/seed-regions.test.ts`、`tests/region-repository.test.ts`。
- 打开首页切到新城市，看区域选择器里的行政区是否齐全、点进去是否显示「暂无饭签」（有新城市没数据属正常）。

## 5. 提交时请一并说明

- 坐标与边界的**来源**（哪个官方接口 / 哪份公开数据 + 获取日期）；
- 是否把该城市设进公开白名单，以及现在有没有数据（没有数据也没关系，但要说明是刻意先开目录还是暂时不公开）；
- 参考 PR 描述模板里的检查项。

## 常见错误

| 现象 | 原因 |
|---|---|
| 城市出现在选择器里但永远空 | 目录写进去了，但该城市没有任何满足店级 ≤¥15 门槛的公开点位（符合预期，不是 bug） |
| 区域接口报 400 | `bbox` 不合法（西≥东、南≥北）、中心不在 bbox 内，或行政区跑出了所属城市 bbox |
| 覆盖状态一直「暂无饭签」 | 点位坐标不在该行政区 bbox 内（坐标抄错或用了 WGS-84 未转 GCJ-02） |
| 城市出现但数据串到别的城市 | `places.city` 归属不对。新点位应经 `PlaceRepository.create` 写入，它会从所属片区派生 city |
