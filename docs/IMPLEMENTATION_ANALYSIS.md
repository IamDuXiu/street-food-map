# 实现分析快照（2026-09-09）

> 面向无上下文接手的 AI：本文件给出现行系统的模块、接口、数据库、权限与历史逻辑的浓缩视图，以及阶段 5 的剩余工作与 2026-09-09 产品决策后的演进方向。
> 详细决策见 `docs/DECISIONS.md`；完整分析与 14 项问答背景见产品工作区 `IMPLEMENTATION.md`、`QUESTIONS.md`、`PRD.md`、`DESIGN.md`、`ACCEPTANCE.md`。

## 1. 当前状态

- 阶段 0～4 已完成并通过本地自动化/视觉验收；阶段 5 工程准备就绪，真实数据采集与真人测试未执行。
- 产品与架构边界：`docs/shenzhen-budget-map-system-plan.md`（注意：§11 地图供应商仍写高德，实际与决策均为腾讯，待更新）。

## 2. 模块地图

| 目录 | 内容 |
|---|---|
| `app/` | 用户端 5 页、后台 8 页、`api/v1` 26 个路由文件（公开 7 + 管理 19） |
| `components/` | 13 个组件：home-client、map-stage、region-picker、place-card、trust-badge、site-header、admin-shell、admin-actions、import-workbench、candidate-pool、candidate-import-preview、coordinate-picker |
| `lib/` | types、filter、geo（WGS-84→GCJ-02）、csv（16 中文列名）、fixtures、map-adapter（TencentAdapter/DemoMapAdapter）、regions（深圳目录）、candidate-pool（1574 行） |
| `lib/server/` | db、repository（734）、services（837）、validation（340）、auth、page-auth、public、media、audit、seed |
| `db/migrations/` | 001 初始 17 表；002/003 索引；004 线索引用触发器；005 投稿令牌/限流；006 候选池；007 schema 漂移对账 |
| `scripts/` | setup-demo、admin-password、backup、restore、maintenance、fresh-start-check、dev-lan、phase5-check、seed-candidate-pool、视觉审计 |
| `tests/` `e2e/` | Vitest 11 文件；Playwright core-flow + candidate-pool（22 流程） |

## 3. 接口

公开：`GET /api/v1/{map,places/:id,config,media/:id}`、`POST /api/v1/submissions(+/:id/media)`、`GET /api/v1/submissions/status`。
管理（全部 requireAdmin）：`admin/{session,csrf,leads(+/batch/preview/commit/drafts),places(+/:id),menu-items(+/:id),price-reports,submissions,imports/preview,imports/commit,exports/full,media(+/:id)}`。
规则要点：map 最多 500 点、`origin` 参数拒绝、DB 不可用 fixture fallback；投稿限流 5/小时、状态查询 10/小时；上传令牌 30 分钟；写接口 Origin+CSRF。

## 4. 数据库

- SQLite：WAL、foreign_keys=ON、busy_timeout=5000；`DATA_DIR/DATABASE_PATH/UPLOADS_DIR/BACKUPS_DIR` 可配。
- 17 张业务表：pilot_zones、places、menu_items、price_reports、tags、place_tags、source_leads、source_lead_items、submissions、evidence_media、moderation_actions、analytics_events、admin_settings、login_attempts、rate_limit_buckets、lead_conversion_drafts、schema_migrations。
- 公开资格谓词在 SQL 层强制（active/open + 非 external_lead verified ≤2500 且 ≤180 天）；`toPublicPlace` 出口双门槛。
- 触发器：线索引用完整性、external_lead 禁 verified、被引用线索禁删。
- 事务：价格替换（superseded 旧价）、四类投稿批准、地点合并、CSV 提交均全有或全无。

## 5. 权限

- 单管理员 scrypt + password_version；HMAC 签名 HttpOnly SameSite Cookie 8 小时；失败 5 次/15 分钟锁定。
- 后台页面 `requireAdminPage()` 先鉴权；API 写操作 Origin 同源 + CSRF 双提交。
- `SESSION_SECRET` ≥32 字节缺失即 500；`DEMO_AUTH=1` 仅测试。
- 匿名投稿：每日轮换盐 HMAC 来源指纹，不存 IP；查询码/上传令牌只存哈希。
- 公开 DTO 不泄露来源 URL、审核备注、审计、payload、存储路径；维护任务 90 天墓碑化被拒投稿。

## 6. 历史逻辑摘要

- 09-01 定名/Next 16.3.4 升级/DemoMapAdapter；09-02 数据边界、备份恢复、页面鉴权、投稿与图片治理；09-03 可交接性与阶段 5 准备；09-04 区域导航扩全市（目录代码维护）；09-08/09 手动排序上线、候选录入收尾、执行日与真实数据解耦。
- schema 演进 001→007，v7 对账现场发现的 schema-6 漂移。

## 7. 剩余工作（阶段 5 实地为主）

1. 20～30 份真实餐食采集与逐条独立核验（AI 可辅助检索与核验清单）。
2. 隔离导入抽查 → 正式入库 + 备份。
3. 部署可访问链接（可运行 Node 的托管，非 GitHub Pages；腾讯 Key 白名单 + HTTPS）。
4. 产品负责人自行招募测试；匿名最小事件（6 类）自动采集指标。
5. 复盘「继续/调整/停止」。

## 8. 2026-09-09 决策后的演进方向（未改代码，另行立项）

- 腾讯地图为准，更新 plan §11 文档。
- CSV 导入弱化/移除（待确认代码动作）。
- analytics_events 接入 6 个最小事件写路径。
- 区域目录迁入可管理数据表 + 后台管理。
- AI 图片合规检查与自动遮挡 + 人工终审。
- 取消 merchant_claimed 枚举（商户=user 来源）。
- 定时备份异地留存；迁移阈值季度自查。
