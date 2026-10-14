# 架构说明

面向「想读懂代码、想改代码」的人。产品口径与收录规则见根目录 [README](../README.md)；环境变量见 [CONFIGURATION.md](CONFIGURATION.md)。

## 一句话架构

**模块化单体**：Next.js App Router 同时承担页面与 API；SQLite（WAL）单文件数据库；页面和路由**不直接写 SQL**，一律经 `lib/server/` 的 repository / service；采集脚本是独立的 Node 脚本，产出「待人工确认」的 JSON，不直接写公开数据。

```
浏览器 ──▶ app/**/page.tsx ──▶ components/**            （用户端 / 后台 UI）
                  │
                  └─▶ app/api/v1/**/route.ts ──▶ lib/server/*.ts ──▶ better-sqlite3 ──▶ data/*.sqlite
                                                       ▲
采集脚本（scripts/collect*.ts）──▶ outputs/*.json ──▶ 后台上传 / 预览 / 提交（人工确认）
```

## 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | Next.js 16 App Router + React 19 + TypeScript 5.6 (strict) | 一个进程同时跑 SSR 页面与 API，自托管成本最低 |
| 数据库 | SQLite + better-sqlite3 11.10（WAL / `foreign_keys=ON` / `busy_timeout=5000`） | 单文件、可备份、无需外部服务；数据量级完全够用 |
| 校验 | Zod 3.23 | 投稿、导入、管理接口统一校验 |
| 图片 | Sharp | 服务端重编码为 WebP、去 EXIF、限制最长边 |
| 地图 | 腾讯 JS API GL；无 Key 时降级内置 Demo 地图 | 中国大陆可用；零密钥也能跑起来演示 |
| 测试 | Vitest（单测）+ Playwright（端到端） | 端到端用隔离临时库，不碰开发数据 |

## 目录职责

| 路径 | 职责 |
|---|---|
| `app/` | 页面与 API 路由。`app/`（用户端）：`/`、`/places/[id]`、`/submit`、`/submit/status`、`/about`；`app/admin/*`：后台；`app/api/v1/*`：接口 |
| `components/` | 组件。`components/ui/` 是共享控件（`Select` / `Notice` / `ConfirmDialog`） |
| `lib/` | 领域模型与纯逻辑：`types.ts`、`cities.ts`（城市白名单与价格常量）、`regions.ts`、`trust.ts`、`filter.ts`、`map-adapter.ts`、`motion.ts`（弹簧动效）、`demo-dataset.ts`（5 城演示数据，纯数据） |
| `lib/server/` | 服务端：`db.ts`（连接 + 迁移执行）、`repository.ts`、`public.ts`（公开读模型）、`region-repository.ts`、`creator-import.ts`、`geocode.ts`、`sources.ts`、`auth.ts`、`audit.ts`、`validation.ts`、`media.ts`、`services.ts`、`seed.ts` 与 `seed-national.ts`（演示数据写入）、`demo-status.ts`（本实例是否含演示数据）、`preflight.ts`（部署前凭据自查） |
| `db/migrations/` | 版本化 SQL 迁移，文件名前缀即版本号，按序在事务中执行 |
| `scripts/` | 初始化、采集、备份恢复、运维、验收脚本 |
| `e2e/` | Playwright 用例（用户端主流程 + 统一 UI 回归） |
| `docs/` | 本文档集合；`docs/archive/` 是历史过程记录 |

## 数据模型

迁移版本 **11**（`001`–`011` 已应用）。核心表：

**目录与区域**
- `regions`：`id / parent_id / name / level(city|district|business_area) / center / bbox / zoom / sort_order / active`。覆盖状态**不落库**，由公开点位派生。
- `pilot_zones`：早期「片区」概念（深大粤海 / 科技园步行区），仍被演示数据与 `places.zone_id` 使用；带 `city` 归属。

**地点与餐食**
- `places`：门店。含 `city`（迁移 010）、坐标（GCJ-02）、`business_status`、`record_status`。
- `menu_items`：具体的一道菜 / 一份饭，挂在 `place_id` 下。
- `price_reports`：价格观测。金额以**分**存储，含 `observed_at`（核验日期）、`verification_method`、`status`。同店同菜只保留最新来源价，旧的 `pending` 置 `superseded`。

**来源与可信度**
- `source_leads` / `source_lead_items`：线索池（含 `creator_id / platform / content_title / content_url / published_at / city / play_count / public_visibility`、`review_notes`）。`source_url` 不公开，`content_url` 是唯一允许外链的例外。
- `creators` / `creator_accounts` / `entity_sources`：创作者与平台账号绑定；`entity_sources` 以 `PRIMARY KEY(entity_type, entity_id, platform, creator_name)` 实现来源去重。
- `price_reports` 上有**触发器禁止 `external_lead` 变为 `verified`**：社区/创作者来源永远只能是「未核验」。

**投稿与审核**
- `submissions`：四类投稿（新地点 / 价格变化 / 纠错 / 停业），含查询码哈希与限流桶。
- `evidence_media`：证据图片，默认 `admin_only`，公开必须经权利确认 + 人工隐私复核 + 关联正式价格。
- `moderation_actions`：审核动作留痕。

**运维**
- `admin_settings`（单管理员，`password_hash` + `password_version`）、`login_attempts`、`rate_limit_buckets`、`analytics_events`、`lead_conversion_drafts`、`schema_migrations`。

## 公开读模型与资格谓词

公开地图只返回满足**全部**条件的点位：

1. 门店 `active` 且 `business_status = open`；
2. 存在 `active` 的餐食，且有 ≤ **¥15**（店级门槛）、**180 天**内、`status ∈ {verified, external_lead}` 的价格；
3. `city` 落在**公开白名单**（北京 / 上海 / 广州 / 深圳 / 杭州）内——`NULL` 视为历史遗留行放行。

其余餐食（高于 15 元）**如实展示**，但展示价有 sanity 上限 ¥200；公开 DTO 里的未核验价格带 `unverified: true` 与来源标签（`平台@UP主`，多来源以 `;` 拼接去重）。公开 DTO **不含** `source_url`、审核备注、审计记录、原始 payload、文件路径、查询码哈希。

相关实现：`lib/server/public.ts`、`lib/server/repository.ts`（`listPublic`）、`lib/cities.ts`（`SHOP_GATE_PRICE_FEN` / `DISPLAY_PRICE_CAP_FEN` / `PUBLIC_CITY_IDS`）。

## API

公开（只读 / 投稿）：

| 接口 | 说明 |
|---|---|
| `GET /api/v1/config?city=` | 价格档、标签、片区、区域目录、地图模式 |
| `GET /api/v1/map?bbox=&city=&q=&maxPriceFen=&zoneId=&tags=&sort=` | 地图点位（最多 500 点） |
| `GET /api/v1/places/:id` | 地点详情 |
| `GET /api/v1/recent` | 最近更新 |
| `GET /api/v1/media/:id` | 受控媒体访问（仅公开图） |
| `POST /api/v1/submissions`、`GET /api/v1/submissions/status` | 匿名投稿与查询码状态 |

管理（`requireAdmin`，写操作额外校验 Origin + CSRF 并写审计）：

`/api/v1/admin/{session,csrf,leads,places,menu-items,price-reports,submissions,imports,exports,media,geocode,regions,regions/:id,creator-import/preview,creator-import/commit}`

## 采集管线

脚本只做**发现**，绝不臆造：抽不到就写「待补」占位并标记。

1. `scripts/creator-collect.ts`（`npm run collect:creators`）：B站 `search/type` 关键词检索 + 可选 YouTube 频道 RSS，按内容链接去重，输出对齐 `creatorImportRecordSchema` 的 JSON（默认 `outputs/creator-collect.json`）。
2. `scripts/web-collect.ts`（`npm run collect:web`）：搜索引擎结果解析（默认百度，必应可选）→ 正文启发式抽取 → LLM 抽取店名/地址/菜品/价格 → 店级 ≤15 元过滤。
3. 后台上传 JSON：`/admin/creator-import` 预览 →（必要时）`/api/v1/admin/geocode` 或手工补坐标 → 提交。

四层去重：内容（跨平台同视频）→ 门店（城市 + 归一化店名 + 坐标 ≤150m）→ 菜品（`place_id` + 归一化菜名）→ 价格（同店同菜只留最新）。

## 迁移纪律（改代码前必读）

- 新增迁移 → `db/migrations/NNN_name.sql`，前缀数字即版本。
- 必须同步：`tests/migrations.test.ts`（清单与版本断言）、`scripts/restore.ts`（`CURRENT_SCHEMA`、`SUPPORTED_BACKUP_SCHEMAS`）、`scripts/backup.ts`（关键表清单）。
- 迁移在 `openDatabase()` 时按序执行，单个迁移在事务中完成；`docs/archive/` 里记录了历史上的一次 schema 漂移对账（version 7）。
- 备份恢复支持旧 schema：应用下次打开数据库时会幂等升级到当前版本。

## 交互与视觉

- 视觉语言：米白纸张底、辣椒红价格、青绿可信标记、票据式虚线、等宽数字；**避开**紫色渐变、通用 SaaS 仪表盘与过度卡片化。控件规范见 [UI-GUIDELINES.md](UI-GUIDELINES.md)。
- 动效：手势相关一律用 `lib/motion.ts` 的解析弹簧（`springTo` / `project` / `rubberband` / `nearestSnapPoint`），可中断、带速度；`prefers-reduced-motion` 下直接跳到终值。CSS transition / `@keyframes` 只用于非手势的状态变化。
- 不变量：**正在入场或退场的浮层绝不能吞掉下一次交互**——退场遮罩必须 `pointer-events: none`；入场中被误瞄的面板不得触发遮罩关闭。改动出入场动画时必须复核这条，`e2e/core-flow.spec.ts` 有对应守门用例。

## 安全模型

- 单管理员会话：签名 Cookie（`SESSION_SECRET`）+ `password_version`（改密后旧会话失效）+ CSRF Token + 同源 Origin 校验 + 审计记录。
- 匿名来源指纹：按每日轮换盐 + 服务端密钥生成不可逆指纹；默认只用 `User-Agent`，只有 `TRUST_PROXY=1` 且可信代理已剥离客户端同名头时才读 `x-forwarded-for`。
- 密钥只走环境变量，不入库、不进 Git、不落日志。
- 详细自查清单见 [SECURITY.md](../SECURITY.md) 与 [DEPLOYMENT.md](DEPLOYMENT.md)。
