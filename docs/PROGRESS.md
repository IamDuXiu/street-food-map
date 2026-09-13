# 阶段 5 准备进度

## 真实产品化：统一风格 + 移除脚手架文案（2026-09-13）

- [x] 用户端与后台端统一浅色体系：后台不再使用深色顶栏/侧栏，沿用 `ac95fab` unified foundation 的浅色 token；`.admin-title h1` 收窄到公共标题同一字号（24–32px）；删除 `demo-pill` 及脉冲动画 CSS。
- [x] 移除 Demo/本地标记：后台页头 `本地工作台`、侧栏 `工作台 / 深圳试点` + `LOCAL DATASET` + `本地数据环境 · 所有写入均可审计`、5 个后台页的 `demo-pill` 徽章、`正在读取本地数据库`、`当前显示本地演示数据`、以及「本地服务/本地数据」类错误文案。
- [x] 移除引导性说明文案：候选池概览段与核验详情默认说明、`三件事都确认，再进入预览`、区域管理/创作者导入/区域目录/投稿审核的页顶说明与提示、区域选择器底部说明与空状态引导、候选导入预览说明、About 品牌语与引导段。
- [x] 移除占位/示例内容：`待共建`（`lib/regions.ts`、`lib/server/region-repository.ts`、`components/region-picker.tsx`）、创作者导入预置 SAMPLE JSON（改为空数组）、候选池空状态的 seed 脚本指引、`试点` 措辞、导入页示意步骤描述与 fake 预览框。
- [x] 线索池与其它后台页对齐：工具栏去掉灰底与描边（改透明），搜索框改白底 1px 描边 + 8px 圆角，左侧店铺列表去掉灰底、白卡直接落在页面背景并移除列表面板外框，详情面板仍为白底 1px 卡片；列表/详情标题分隔线由 2px 墨色改 1px，标题字号收窄。
- 保留（属真实产品内容）：公共「收录标准 / 可信度 / 数据声明」、错误与状态提示、字段标签与 aria、英文编号脚手架（01/02 等）。
- 验证：`npm run lint` / `typecheck` / `npm test`（25 文件 / 150 测试）/ `build` / 全量 e2e **46 通过**（mobile + desktop）。

## 表单与下拉控件统一（2026-09-13）

- [x] 修复投稿表单下拉“标签与控件同行”：`.submission-form` 的块级控件规则原先只覆盖 `input`/`textarea`，漏掉 `select`；补入后 `地点/餐食/核验方式/状态/所属样板区/要修改的字段` 统一为“上标题、下控件”，帮助文案独占一行。
- [x] 新增 `components/ui/Select`（combobox + listbox）：三角符右边距固定 10px；展开列表宽度锁定为字段宽度、不超出；支持方向键/Home/End/Enter/Esc、点击外部关闭、`aria-invalid/aria-describedby`；值写入同名隐藏 `input`，`FormData` 与提交链路不变；提供 `field/compact/bare` 变体。
- [x] 迁移全部原生 `<select>`：投稿表单 7、候选池 6（4 表单字段 + 风险筛选 + 恢复最近草稿）、区域管理 2、审核动作 1、首页筛选 2（条件/排序用 `bare` 保留原筛选胶囊）。
- [x] 区域目录弹窗改版：浅色 surface、12px 圆角、柔和投影；“当前城市”并入头部并删除重复横幅；城市改胶囊 chip；左栏目录圆角选中态 + 品牌侧条；覆盖状态改软标签。
- [x] 交互一致性修复：候选池字段控件直角改 8px 圆角、硬偏移焦点阴影改品牌柔光环；`.choice-grid` 单选卡改品牌焦点 + 圆角。
- [x] e2e 同步：`core-flow`/`candidate-pool` 中受影响的 `selectOption`/`toHaveValue` 改用自定义控件（`getByRole('combobox')` + `[role=option][data-value]`）。

验证（2026-09-13）：
- `npm run lint` / `typecheck` / `npm test`（25 文件 / 150 测试）/ `npm run build`（exit 0）全通过。
- 定向 e2e 通过：用户端筛选状态恢复、定位后排序、候选池完整提交链路。
- 计算样式：表单下拉列表宽 680px = 字段宽；首页筛选列表 88px = 字段宽；箭头距字段内边 10px。
- 既有 e2e 失败**已修**（2026-09-13 遗留清理）：4 处区域导航名陈旧的 `深圳行政区` 改为实际渲染的 `深圳市行政区`（`e2e/core-flow.spec.ts` ×3、`e2e/unified-ui-regressions.spec.ts` ×1）；1 处投稿类型文案正则 `/价格变化/` 改为与实际文案一致的 `/价格有变化/`（`e2e/core-flow.spec.ts`）。全量 e2e **46 通过**（mobile + desktop）。

## 统一 UI 基础（2026-09-12）

- [x] 建立白/浅灰/黑色 foundation tokens、1px 边框、8–12px 圆角、克制珊瑚品牌色、可见焦点和 40–44px 控件基线。
- [x] 公共 `Notice`（显式 error/success/info tone）与 `ConfirmDialog` 组件及 class 合同，ARIA role 不再推断绿色；确认弹窗支持焦点循环/恢复、Esc 锁定、异步失败可重试且防重复。
- [x] 统一公共/后台头部与后台浅灰侧栏；移除站点头部 `SHENZHEN / 01` 与演示旧标签，登录侧栏隐藏、蜜罐可靠离屏、loading 壳稳定。
- [x] 更新首页/最近核验条关键辅助文字可读性；地图 SDK 容器与腾讯 logo 未触碰。

交接合同详见 [`docs/UI_GUIDELINES.md`](./UI_GUIDELINES.md)。详情/投稿/后台页面仍由对应页面 agent 做最终截图微调。

更新时间：2026-09-11（首页/详情可用性优化 8 项完成）

## 首页/详情可用性优化（2026-09-11）

- [x] 可信度派生：`lib/trust.ts` + `VerificationLevel` 增加「中可信」+ `toPlace` 按餐食派生（修掉写死「高可信」bug）+ `trust-badge` 分级配色 + 卡片可信摘要行。
- [x] 新鲜度四档：`lib/freshness.ts` 唯一分档来源，DTO 输出 `近期核验/有效/可能过期/已过期` + `ageDays`，卡片相对时间文案与配色，覆盖 30/31/90/91/180/181 边界。
- [x] 品类 emoji：`lib/category-emoji.ts` + 店名前 emoji，地图点位不改。
- [x] 距离常显：`withRegionDistance`/`formatDistance`，非 nearby 按视野中心附加，nearby 不重复叠加，卡片「距你/距中心」。
- [x] 可移除筛选 chips 与「我的附近」按钮。
- [x] 价格变动标记：`previousPriceFen`/`priceChange` 派生，卡片 ↑↓、详情「较上次/首次核验」，覆盖上涨/下降/持平/首次/多历史/合并。
- [x] 最近核验入口：`listRecentlyVerified` + `GET /api/v1/recent` + `recent-strip`，空/错误/待共建静默隐藏。
- [x] 文档：`DECISIONS.md`（8 采纳/3 优先修/11 不采纳/13 不做）、`shenzhen-budget-map-system-plan.md` §10 API 增补 `/api/v1/recent` 与新 DTO 字段。

验证结果（2026-09-11）：
- `npm run lint`、`npm run typecheck`、`npm run build`：通过。
- `npm test`：通过，16 个文件 93 个测试（新增 trust/freshness/category-emoji/price-change/recent 及 filter 距离）。
- `npm run test:e2e`：通过，34/34（移动端 + 桌面端）。
- `scripts/home-usability-visual-audit.py`：通过，375px 与 1440px 首页无横向溢出、无浏览器控制台错误；截图见 `artifacts/home-usability/home-375.png`、`artifacts/home-usability/home-1440.png`。「最近核验」条在演示数据（距今 >7 天）下按预期静默隐藏；用临时新鲜数据验证其渲染为「店名 · 最低价 · 今天核验」且无溢出。

## 候选录入链路收尾 + 阶段 5 状态更新（2026-09-09）

- [x] 候选提交成功后在同一事务内删除 `lead_conversion_drafts` 草稿并返回 `deletedDraftId`；客户端提交成功即清除 `candidatePoolDraftId` 本地键，避免“最近草稿”残留已提交草稿、刷新即 404。
- [x] 补单元断言（成功提交删草稿 / 过期版本 409 保留草稿）与 e2e 全链路（勾选 → 保存草稿 → 预览 → 确认提交 → 成功文案 → 草稿从下拉消失）。
- [x] 修正 core-flow 排序 e2e：两处选择器指向已不存在的旧占位卡类（`.meal-preview` / `.place-card-footer`），改为当前 `.place-card-price` / `.place-card-meta`；新鲜度断言原本比较“卡片展示的最低价餐食日期”，与排序键（每家最新核验）不一致，改为校验 `sort=freshness` 请求已发出且 UI 已切换，排序数学由单元测试覆盖。
- [x] 手动排序控件（最低价 / 最近核验 / 附近优先，附近仅定位后可选）确已于 2026-09-08 在首页上线；决策为保留并纳入本轮评估，`analytics_events` 写入仍延后（见 `DECISIONS.md` 2026-09-09）。
- [x] 新增 `docs/PHASE5_RUNBOOK.md` 交接手册；阶段 5 正式执行日改为“真实数据就绪并隔离导入通过后”，不再承诺 2026-09-10。
- [ ] 仍待实地：20–30 份真实餐食采集与独立核验、隔离导入抽查、6–8 人（最多 10 人）真人测试及复盘报告。真实腾讯/高德 Key、手机 HTTPS 定位同意流程仍未现场验证。演示 seed 不得计入真实数据。

## 深圳全市区域导航已完成

- [x] 首页从固定样板区下拉升级为“深圳全市 → 9 个行政区 + 大鹏新区 → 首批常用商圈”的可搜索区域选择器；顶部展示当前城市“深圳市”，左侧目录固定按“我的附近 → 全城 → 各区”排序。
- [x] 区域目录独立于 `pilot_zones`；地图通过坐标 `bbox` 查询全市、区和商圈，现有数据表与导入流程无需迁移。
- [x] 地图开放范围与真实数据覆盖分离：南山区两个试点显示“已有饭签”，其他区域显示“待共建”和投稿入口，不填充虚假点位。
- [x] Demo 地图按真实坐标投影自有点位；高德适配层按区域同步中心和缩放；API fixture fallback 同样执行 bbox 过滤。
- [x] 新增区域目录单测和“行政区/商圈选择、待共建空状态、区域搜索、我的附近/全城目录入口与当前选择高亮”端到端流程；真实高德 Key 路径仍未现场验证。

## 阶段 5 准备就绪（真实执行待完成）

- [x] 已确认局域网测试方式、粤海街道上班族目标对象、首轮 6–8 人（最多 10 人）、每人 10–15 分钟和 2026-09-10 截止；没有真实数据时不开放测试。
- [x] 新增 `npm run dev:lan`，绑定 `0.0.0.0`，只在可信 Wi‑Fi/个人热点使用，并在终端显示运行时局域网地址；不向受试者暴露后台或管理员凭据。
- [x] 新增 `docs/PHASE5_TEST_GUIDE.md`，覆盖准备/真实数据导入/主持演练/30 秒计时/故障回退/隐私边界和复盘；局域网手机只验证定位不可用/拒绝后的回退，定位同意仅在主持人 `localhost` 内部演练。
- [x] 新增集中在一个科技园步行区的 20–30 份真实餐食核验清单，以及导入模板、匿名观察表和空白复盘模板；模板表头与 `BUDGET_IMPORT_HEADERS` 保持一致。
- [x] 未接入 analytics_events 写入（仍延后）；手动排序控件已实现并纳入本轮评估（2026-09-08 上线，决策见 `DECISIONS.md` 2026-09-09）。

尚未完成：真实 20–30 份数据采集、独立核验、隔离导入抽查、6–8 人（最多 10 人）真人测试及复盘报告。不得用演示 seed 代替这些工作。

## 阶段 2 已完成

- [x] SQLite 驱动的公开 `/api/v1/config`、`/api/v1/map`、`/api/v1/places/:id`，统一非法参数 400、规则过滤、脱敏、bbox/标签/排序和 500 上限。
- [x] 首页 loading、错误/本地演示 fallback、覆盖状态空页面、全市区域选择器与首次定位；定位拒绝、超时和不可用均回退深圳全市，精确坐标不持久化。
- [x] WGS-84→GCJ-02 集中转换函数与 Demo/Amap 适配层；高德在线加载失败安全降级，真实路径清理地图、标记和监听器。
- [x] 数据库详情页和导航链接；公开价格、新鲜度与查询规则一致。

## 阶段 3 已完成（本地闭环）

- [x] 四类严格 Zod 投稿联合、蜜罐、服务端字段/HTML/坐标/日期/价格校验；匿名投稿初始 pending。
- [x] 投稿返回只显示一次的 128-bit 查询码和短期、绑定投稿的上传令牌；数据库只存哈希，查询码不能上传图片。
- [x] 投稿每小时 5 次、状态查询每小时 10 次；每日轮换盐和服务端密钥生成不可逆来源指纹，不保存原始 IP。生产需明确可信反向代理边界。
- [x] JPEG/PNG/WebP 签名校验、原图 10MB/投稿 5 张限制、Sharp WebP 重编码、最长边 1600、EXIF 清理、受控相对路径；管理员可上传关联替代图。
- [x] 后台证据缩略图和权利/隐私复核；needs_verification/rejected/duplicate 不写正式数据，四类 approved 映射在同一事务中写入正式事实、证据关联、审核记录和审计。
- [x] 用户成功页一次性查询码、状态查询页和上传失败保留投稿提示；公开媒体仅限已复核且关联正式价格事实的记录。

## 阶段 4 已完成（本地交接范围）

- [x] 用户端和后台增加页面级 loading/error 边界；投稿、状态查询、后台审核/媒体操作增加进行中、失败和可恢复提示，不向用户展示内部异常。
- [x] 关键表单保留语义标签、状态播报和焦点样式；投稿/状态表单的总错误提示具有稳定 `aria-describedby` 关联，状态查询输入会标记 `aria-invalid`（尚未实现逐字段错误）；地图信息继续由列表替代入口访问；375px 响应式规则覆盖用户端和后台，减少横向溢出风险。
- [x] 新增 `npm run fresh-start`，在系统临时隔离目录实际调用 README 的 `setup`、公开 repository 查询和备份实现，并在结束时清理临时目录，不触碰默认 `data/`、`uploads/`、`backups/`。
- [x] 新增面向非技术负责人的 `docs/OPERATOR_GUIDE.md`，覆盖启动、审核、证据图片、导入、演示数据清理、备份恢复、故障和安全边界。
- [x] Playwright 保留阶段 0–3 主流程并补充空状态恢复、模板下载、键盘焦点和 375px 后台错误反馈；测试数据使用隔离目录，并在每次运行前构建当前代码。

阶段 5 已完成准备但尚未执行真实数据采集和真人测试；没有部署、外部账号、云存储、豆瓣抓取或在线打码编辑器。真实高德 Key 和公网生产代理也未现场验证。

## 已完成

- [x] Next.js 16.3.4 App Router、TypeScript strict、npm lockfile、ESLint/Prettier/Vitest/Playwright。
- [x] 阶段 0 用户端流程和 DemoMapAdapter：地图点位、视野切换、列表联动、筛选、详情、规则、投稿演示页。
- [x] better-sqlite3 版本化迁移、WAL/foreign_keys/busy_timeout、pilot_zones/places/menu_items/price_reports/tags/source_leads/submissions/evidence_media/moderation_actions/analytics/admin 表、幂等演示 seed。
- [x] repository/service 边界：价格替换事务、新鲜度和价格门槛、重复候选、地点合并、投稿审核、CSV 服务端预览与全有或全无提交。
- [x] 单管理员 scrypt 哈希、签名 HttpOnly/SameSite 会话、8 小时过期、password_version 失效、失败 5 次/15 分钟锁定、退出、Origin + CSRF。
- [x] 所有后台服务端页面（含导入、导出）统一鉴权并匿名重定向登录；SESSION_SECRET 缺失安全失败，setup 首次生成 32 字节随机密钥并替换弱值；管理员用户名固定且可由环境变量配置；setup 相同密码保持版本幂等。
- [x] 后台真实数据工作台：dashboard、线索、投稿审核动作、地点/餐食/价格写入入口、CSV 导入预览/确认、审计记录、ZIP 备份入口；地点管理区分公开查询与后台全状态列表，并提供合并影响预览/确认。
- [x] 备份含 SQLite 一致性快照、关键表 JSON、uploads 和 SHA-256 manifest；恢复含只读校验、自动备份、确认词和原子替换；maintenance 具备文件失败回滚。
- [x] restore 拒绝 ZIP 路径穿越/符号链接，校验 manifest 全量文件、schema/integrity/media 引用，并在 DB 与 uploads 任一替换失败时整体回滚；CSV 按片区、来源和同地点多餐食规则原子提交；阶段 1 明确拒绝非空 evidence_filename（图片导入留到阶段 3）；source_lead 引用由 SQLite 触发器保护。
- [x] `.gitignore` 覆盖 data SQLite/WAL/SHM、uploads、backups 和测试产物，仅保留 `.gitkeep`。

## 实际验证（2026-09-04）

- `ADMIN_PASSWORD=phase1-demo-password npm run setup`：通过，迁移和 seed 幂等。
- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：通过，9 个文件、46 个测试；在原有后台、导入、备份恢复、认证与公开 DTO 覆盖上，新增深圳 9 个行政区 + 大鹏新区目录、区域编号/父级/边界和覆盖状态校验，并继续覆盖中文导入表头、阶段 3 schema、限流、图片清理、四类审核事务等规则。Vitest 使用唯一临时数据库，默认演示库未被测试写入。
- `npm run build`：通过，33 个 App 路由生成；媒体文件使用运行时受控路径，构建仅提示动态 filesystem tracing 警告，不影响构建成功。
- `npm run test:e2e`：通过，移动端与桌面端共 22/22 个流程；新增“行政区 → 商圈”、区域搜索、待共建空状态、我的附近/全城目录入口和基于当前选择的高亮，原有导入、地图、投稿、审核、公开价格、空结果恢复、键盘焦点和 375px 后台反馈继续通过。测试每次先构建当前代码，再从隔离临时目录启动，避免误测陈旧 `.next` 或污染默认数据。
- `scripts/shenzhen-region-visual-audit.py`：通过；375px 手机与 1440px 桌面区域选择器无横向溢出、无浏览器控制台错误。截图见 `artifacts/shenzhen-regions/picker-futian-375.png`、`artifacts/shenzhen-regions/picker-nanshan-1440.png`。
- `npm run fresh-start`：通过；临时目录内实际运行 setup、读取 5 个公开地点并生成隔离备份，结束后自动清理。
- `npm run phase5:check`：通过；验证 `dev:lan` 绑定配置、16 个中文导入表头、两个 UTF-8 BOM 模板和匿名观察字段。
- `npm run dev:lan`：入口会先打印运行时局域网地址；本受限沙箱随后因禁止监听 `0.0.0.0:3000`（`EPERM`）退出，未声称跨设备或本机 HTTP 烟测通过；应在允许端口的本机环境执行。
- 对比度抽查：主文字/米白纸张 15.04:1、弱化文字/米白纸张 5.21:1、红色强调/米白纸张 5.19:1、绿色状态/米白纸张 5.74:1、白字/深色后台 16.66:1，达到 WCAG AA 的普通文字门槛；焦点轮廓使用高亮黄色并保留键盘可见性。
- `npm run backup`：通过，生成被忽略的 ZIP（当前 schema 5，包含 SQLite、关键表 JSON、限流桶、uploads、manifest）。
- `npm run restore -- --from <schema-4/5 备份.zip> --confirm RESTORE-BUDGET-MAP`：schema-4/5 均保留兼容，只读校验、自动备份和 DB+uploads 恢复；单测另覆盖模拟替换失败双回滚。
- `npm run maintenance`：通过，演示库输出 `{ rejected: 0, media: 0 }`；单测另行覆盖失败回滚。
- `npm run dev -- --hostname 127.0.0.1`：通过；进程持续存在，首页返回 200，匿名 `/admin` 返回 307 并定位 `/admin/login`，匿名 session API 返回 401。未修改只读 `AGENTS.md`。
- `npm test` 前后默认 `data/budget-map.sqlite` 未被阶段 3 单测写入；阶段 3 上传文件也只写入测试隔离目录。
- `npm audit --omit=dev --offline`：通过，生产依赖返回 `found 0 vulnerabilities`。依赖保持 Next 16.3.4、React 19.1.0，overrides 实际解析 postcss 8.5.23、sharp 0.35.4。
- 阶段 3 视觉验收：通过；375px 匿名投稿成功页和 1440px 后台审核页均无横向溢出、无浏览器控制台错误。审核页发现并修复了操作区横排导致的 84px 溢出。截图见 `artifacts/phase-3/submission-success-375.png`、`artifacts/phase-3/submission-review-1440.png`（真实高德 Key 未现场验证）。
- 阶段 4 视觉验收：通过；移除会掩盖问题的全局横向裁剪后，375px 空结果页和后台登录失败页仍无横向溢出；搜索框键盘焦点具有可见黄色轮廓。截图见 `artifacts/phase-4/empty-state-375.png`、`artifacts/phase-4/admin-login-error-375.png`。

## 阶段边界与未解决风险

- 阶段 2、阶段 3、阶段 4 本地闭环均已完成；真实高德 Key 路径已实现但未在本地配置 Key 做现场底图验证。
- 阶段 3 使用本地 SQLite 与 `uploads/`，没有云存储或公网部署；管理员必须人工完成隐私检查，系统不会自动识别图片中的敏感信息。替代图不会删除原图，原图持续 `admin_only`。
- 当前管理员写入已是真实本地 SQLite 操作，产品负责人应只在本机演示数据上使用；生产部署前仍需重新审计依赖、密钥管理、反向代理 Origin 策略和备份存储权限。`npm run setup` 会把随机 SESSION_SECRET 写入被忽略的 `.env.local`，会替换缺失或弱值但不会覆盖已有强值。CSV 仍不直接接收图片，证据媒体必须走阶段 3 的受控上传链路。
- 手机通过 HTTP 局域网地址访问时通常无法授予浏览器定位权限；阶段 5 手机测试使用区域选择器并观察回退。真实手机定位同意流程仍需 HTTPS 测试地址，当前未验证。
- 公开查询 API 已支持距离、价格和新鲜度排序；首页手动排序控件已于 2026-09-08 上线并纳入本轮任务测试评估。`analytics_events` 表和清理策略已存在，但用户行为事件写入尚未接通，仍延后到首轮复盘决定；不应误认为已经完成。
- Next 16.3.4 的开发模式曾触发只读 `AGENTS.md` EACCES；本轮配置 `agentRules:false` 后服务已持续运行并成功响应，但需后续版本持续观察，不能修改项目指令文件规避。

## 创作者来源数据层（2026-09-13）

- migration 008（`regions` 区域目录）与 009（`creators` / `creator_accounts` / `entity_sources`，及 `source_leads` 的 `creator_id/platform/content_title/content_url/published_at/city/play_count/public_visibility` 列）；schema 7 → 9。
- `scripts/seed-regions.ts`：幂等回填深圳完整目录（10 区 + 64 商圈）+ 珠三角其余 8 市市级行，接入 `npm run setup` 与新增 `npm run seed:regions`。
- `lib/server/sources.ts`：来源标签 `platform@creator` 去重、按平台与创作者名稳定排序后以 `;` 拼接；`entity_sources` 幂等读写；公开读模型挂载地点级 `sources` 与菜品级 `source`。
- `lib/server/repository.ts` + `lib/server/public.ts`：无已核验价时，创作者价（`external_lead`）作为兜底餐食公开并标记 `unverified`；公开资格谓词与最低价纳入创作者来源；`freshest_observed_at` 仍只取已核验价（「最近核验」不受影响）。
- `lib/trust.ts` + `lib/types.ts`：新增 `低可信` 等级，`external_lead → 低可信`；`placeTrust` 仅把非低可信餐食计入已核验次数。
- `lib/server/geocode.ts`：腾讯 WebService Geocoder 服务端封装（可注入 fetch）；无 Key / 非 0 状态 / 网络异常一律安全返回空数组，Key 只从 `TENCENT_MAP_WEB_SERVICE_KEY` 读取、不落日志。
- `scripts/restore.ts` / `scripts/backup.ts`：支持 schema 4–9 备份恢复，关键表 JSON 增加新表。

验证（本机 `npm run lint` / `npm run typecheck` / `npm test`）：通过，20 个文件 111 个测试；新增 `sources`、`creator-public`、`geocode`、`seed-regions` 测试与迁移 schema 9 断言。注意：区域运行时目录仍读 `lib/regions.ts`（双轨，尚未切换到 DB）；创作者内容的导入/管理后台仍在后续切片。

### 创作者来源用户端展示（2026-09-13）

- `components/place-card.tsx`：创作者来源的卡片显示「创作者来源 · 未核验」、`来源 bilibili@…` 行与价格旁「未核验」标签；时间文案改用 `relativePublishedLabel`（「今天发布 / N 天前发布」），不再冒充「核验」。
- `app/places/[id]/page.tsx`：价格区显示「未核验 · 创作者来源」；未核验餐食行显示来源而非核验日期；新增右栏「内容来源」（`platform@creator` 列表）+ 未核验免责声明。
- `lib/freshness.ts`：新增 `relativePublishedLabel`。
- `app/globals.css`：新增 `.source-label`、`.unverified-tag`、`.source-cloud`。
- `lib/server/public.ts`：公开 DTO 透传 `sources`。
- 验证：`npm run build` 通过；用临时库造「仅创作者来源」门店，生产服务实际渲染确认卡片与详情页均显示来源与未核验标识。`npm test` 111 通过。

尚未做：创作者内容导入/管理后台与地理编码确认接口。

### 区域目录运行时切换 DB + 珠三角城市切换（2026-09-13）

- `lib/server/region-repository.ts`：从 `regions` 表构建「城市 → 行政区 → 商圈」目录，覆盖状态由 bbox 内是否存在公开点位派生；`listRegionCities()` 返回珠三角 9 市；表为空时返回 null 并打印一次告警，回退静态 `lib/regions.ts`。
- `app/api/v1/config/route.ts`：支持 `?city=<id>`，区域目录改由 DB 提供，DB 不可用或表空时回退静态目录。
- `components/home-client.tsx`：新增 `cityId` 状态，按城市拉取 config；切换城市时重置所选区域、定位与视野；`nearbyViewport` 无定位时回退当前城市而非写死深圳；城市随会话状态一起恢复。
- `components/region-picker.tsx`：新增城市切换器（9 市），标题/导航/「全城」图标改用当前城市；无下级目录的城市显示「目录整理中」而非空白。
- `scripts/seed-regions.ts`：广州 bbox 东界由 114.06 收紧到 113.74，避免与深圳数据在 bbox 查询上串城。
- 测试：新增 `tests/region-repository.test.ts`（DB 构建、覆盖派生、空目录城市、空表回退、config 按城市返回），共 21 文件 116 测试通过；`build` 通过；临时库真机验证城市切换后仅返回该城市结果。

已知限制：城市/商圈仍以近似 bbox 划分，相邻城市边界可能重叠；彻底解决需给 `places`/`pilot_zones` 增加明确城市归属。`lib/regions.ts` 仍是双轨回退来源，后台区域管理页尚未实现。

### 创作者内容导入 + 地理编码确认接口（2026-09-13）

- `lib/server/creator-import.ts`：创作者内容记录（店名/菜品/价格/地址/城市/平台/UP主/视频链接）的校验、预览与提交。预览缺坐标时调用腾讯地理编码并把候选坐标回传；提交在单事务内复用/新建门店（归一化店名 + ≤150m 合并）、去重菜品、写最新 `external_lead` 价格（旧 pending 置 superseded）、聚合 `entity_sources`（地点级 + 菜品级）、登记 `source_leads`（`public_visibility='listed'`）并审计；按城市自动创建「创作者来源」试点片区（`creator-<city>`）。价格上限 25 元、坐标限珠三角范围。
- 新增管理接口：`POST /api/v1/admin/creator-import/preview`、`POST /api/v1/admin/creator-import/commit`（写操作 + Origin/CSRF）、`POST /api/v1/admin/geocode`（地址→GCJ-02 候选，无 Key 安全返回空）。
- 测试：新增 `tests/creator-import.test.ts`（预览/地理编码注入/待确认坐标/越界拒绝、同店多来源合并与来源聚合、提交后公开为未核验低可信、缺坐标回滚、三个路由的鉴权与 CSRF 集成），全量 22 文件 126 测试通过；`build` 通过，三个路由已进入产物。

尚未做：创作者内容抓取脚本。

### 后台区域目录管理页（2026-09-13）

- `lib/server/region-repository.ts`：新增 `listAdminRegions` / `createRegion` / `patchRegion` 与 `RegionError`；校验 bbox 顺序、中心落在 bbox 内、层级与父级合法（城市无父级、行政区挂城市、商圈挂行政区）、区域落在所属城市范围内、同父级名称唯一；城市与行政区不可停用（仅商圈可 `active=0`）；写操作全部 `recordAudit`。
- 新增管理接口：`GET/POST /api/v1/admin/regions`、`PATCH /api/v1/admin/regions/:id`（写操作 + Origin/CSRF）；`lib/server/validation.ts` 新增 `regionCreateSchema` / `regionPatchSchema`。
- 新增 `app/admin/regions/page.tsx` + `components/region-manager.tsx`：选城市/行政区 → 列出商圈（启用/停用、编辑）→ 新增/修改商圈表单（bbox、中心、zoom、排序）。后台导航新增「区域目录」。
- 测试：新增 `tests/region-admin.test.ts`（新增/改名/停用与目录联动、非法 bbox/越界/父级/重名拒绝、城市与行政区不可停用、接口 401 与增改集成），全量 23 文件 131 测试通过；`build` 通过。
- 验证：生产服务真机走查——登录后台 → 区域目录 → 选深圳市/南山区 → 新增「南头古城」→ 提示「商圈已新增」；`/api/v1/config?city=shenzhen` 的南山区商圈列表已含「南头古城」，即改即生效于用户端。

尚未做：创作者内容抓取脚本。

### 后台创作者导入页（2026-09-13）

- 新增 `app/admin/creator-import/page.tsx` + `components/creator-import-workbench.tsx`：粘贴创作者内容 JSON → 预览校验（缺坐标显示「待确认坐标」）→ 逐条「解析地址」调 `/api/v1/admin/geocode` 取候选或手填经纬度 → 「确认导入」调 `/api/v1/admin/creator-import/commit`（自动取 CSRF，全部或全不写入）。行内显示就绪/待确认/非法状态、是否合并到已有门店。
- `components/admin-shell.tsx`：后台导航新增「06 创作者导入」入口。
- `app/globals.css`：新增 `.creator-import-*` 样式（含移动端单列）。
- 验证：`lint` / `typecheck` / `test`（22 文件 126 测试）/ `build` 全通过；生产服务真机走查——登录后台 → 打开创作者导入页 → 预览得到「待确认坐标」→ 手填坐标后提交「已导入 1 条（新建门店 1 个）」→ 用户端地图出现「创作者来源 · 未核验 / 来源 bilibili@济州土著susu수수 / 未核验 ¥12」。

### 创作者内容采集脚本（2026-09-13）

- 新增 `scripts/creator-collect.ts`（`npm run collect:creators`）：B站关键词检索 + 可选 YouTube 频道 RSS，归一化为可粘贴到 `/admin/creator-import` 的 JSON（默认 `outputs/creator-collect.json`，运行时目录，已被 gitignore）。
- 导出纯函数便于测试：`extractPrices/pickBudgetPrice`、`detectCity`（含「中山路/中山八」歧义排除）、`deriveMealName`、`extractStoreName`、`extractAddress`、`videoToLead`、`parseBilibiliSearch`、`searchBilibiliVideos`、`parseYoutubeFeed`、`fetchYoutubeChannelVideos`、`collectCreatorLeads`、`mergeCollectRecords`。
- CLI：`--keywords / --youtube / --pages / --delay-ms / --out / --strict / --no-merge / --help`；自动读取 `.env.local` 中可选 `BILIBILI_COOKIE`。
- 策略：价格 >25 元、非珠三角城市、重复内容链接直接跳过；店名/地址缺失写「待补」占位并在 `collect.*` 标记；`--strict` 只保留已抽出店名与地址的记录。
- 测试：新增 `tests/creator-collect.test.ts`（13 例：金额/城市/菜品/店名/地址抽取、schema 兼容、B站与 YouTube 解析、跨关键词去重与 strict、输出合并），全量 `npm test` 24 文件 144 测试通过；`npm run lint` / `npm run typecheck` / `npm run build` 全通过。
- 真实抓取（2026-09-13，默认 12 词 / `--pages 1`）：抓取 220 条 → 产出 35 条（广州 15 / 深圳 10 / 佛山 3 / 珠海 3 / 东莞 1 / 惠州 1 / 江门 1 / 肇庆 1）；可信命名 2 条（`张槎海口两肉一菜快餐店`、`宏兴茶餐厅`，与线索文档高置信回填一致），其余为待补占位。skip：无预算价 137、非探店 28、重复 16、请求失败 1、无城市 1。产出在 `outputs/creator-collect.json`（gitignore）。
- 首轮暴露的噪声/限流已加固：非探店标题过滤、店名抽取收紧（拒绝数字/价格/通用营销词/创作者名、`丨` 分段取店名）、地址含「的/！/？」判无效、B站 `-412` 线性退避重试（最多 3 次）、CLI 默认 `--delay-ms 1500`。
- 新增 `tests/creator-collect-import.test.ts`：采集记录补坐标后经 `previewCreatorImport` / `commitCreatorImport` 进入公开地图，验证 `宏兴茶餐厅` 为「低可信」且来源 `bilibili@粤城旧事`——打通「采集 → 预览 → 提交 → 用户端」服务端链路。
- 验证：`npm run lint` / `npm run typecheck` / `npm test`（**25 文件 147 测试**）/ `npm run build`（exit 0）全通过。
- 浏览器端到端走查（2026-09-13，隔离临时实例，端口 3210，未触碰真实数据/凭据）：`npm run setup` 建临时库并设临时管理员 → 浏览器登录后台 → 创作者导入页粘贴采集记录 JSON（宏兴茶餐厅，含坐标）→ 「预览校验」显示「1 条就绪」→ 「确认导入」返回「已导入 1 条（新建门店 1 个）」；DB 校验：`places` active、`menu_items` 1 条、`price_reports` `external_lead` 2000 分 `pending`、`entity_sources` 地点+菜品级各 1 条、`source_leads` `listed`；公开 `GET /api/v1/places/:id` 返回 `verification=低可信`、`sources=bilibili@粤城旧事`、餐食 `unverified=true`，`GET /api/v1/map?city=guangzhou` 命中该点。临时实例已停止、临时目录已删除。
- 腾讯自动地理编码已验证（2026-09-13，Key 仅写入 gitignored `.env.local`，不入库/不进 Git/不落日志）：直连 `apis.map.qq.com/ws/geocoder/v1/` 返回 `status=0`；`geocodeAddress('广州市番禺区南村镇金江大道217-219号')` → `113.387066,23.004642`；`previewCreatorImport` 对该地址返回 `ready` 且带 1 个候选。
- 该验证暴露并修复一个数据质量缺陷：采集脚本写的「广州市（待补地址）」占位地址会被腾讯模糊匹配到市中心，导致预览误判 `ready`。新增 `isPlaceholderAddress()`（`lib/server/geocode.ts`），`geocodeAddress` 对含「待补/待确认/待定位/占位/TODO」的地址直接返回空，`previewCreatorImport` 明确报「地址是「待补」占位…」并标 `needs_coordinates`；复测：真实地址 `ready`、占位地址 `needs_coordinates` 且不发起请求。
- 验证：`npm run lint` / `npm run typecheck` / `npm test`（**25 文件 149 测试**）/ `npm run build`（exit 0）全通过。

### 采集结果复核包（2026-09-13）

- 合并去重「采集 35 ∪ 候选勾选 46 ∪ §4.5.2 精确回填 5」→ **75 条**，产出文档仓 `LEADS-复核队列-2026-09-13.md`：分「可直接入库 4 / 有候选 POI 待勾选 46 / 仅采集需看片补录 24 / 待补价格 1（首尔餐厅）」四类。
- 生成 `outputs/creator-import-ready.json`（4 条：好大碗牛腩粉、现炒快餐、香港才记牛什粉面店、宏兴茶餐厅；元数据取自 `LEADS-创作者-珠三角.md` / `LEADS-创作者-susu.md`，非臆造）。临时库验证：`creatorImportRecordSchema` 全部通过、`previewCreatorImport` 4 条 `ready`、`commitCreatorImport` 新建 4 个门店、公开为「低可信」且来源标签正确（`bilibili@阿邓来了b站版` 等）。
- **未**写正式库（`data/budget-map.sqlite`，只读核对为 5 个 demo 点、regions 空）：入库待用户确认，可粘贴 `creator-import-ready.json` 到 `/admin/creator-import` 或经脚本导入。
- 残留噪声（已在复核文档标注、无功能影响）：采集结果里仍有「厂/中介/挑战吃一天/外地店」等非探店或非珠三角条目落入「需看片补录」清单，需人工剔除。
- **已导入正式库（2026-09-13）**：先 `npm run backup`（`backups/budget-map-backup-20260913063923.zip`）+ `npm run seed:regions`（regions 0→83），再用 `commitCreatorImport` 写入 4 条（`places` 5→9；`pilot_zones` 新增 `creator-foshan/shenzhen/guangzhou`）。实时校验：`GET /api/v1/map` 返回 9 点，4 条均为「低可信」带来源标签；`GET /api/v1/places/:id` 返回 `unverified=true` 与正确来源；`bbox` 按城市命中（佛山→牛腩粉、深圳→现炒快餐/才记、广州→宏兴）。已知：广州 bbox 会纳入佛山点（相邻城市 bbox 重叠，待根治）。导入脚本为临时文件，已删除。

### 珠三角 8 市行政区回填（2026-09-13）

- 新增 `lib/region-districts.ts`：由腾讯地图 WebService `district/v1/getchildren`（`get_polygon=1`，GCJ-02，`data_version` 2026-04-28）一次性生成并**固化**的 8 市行政区种子，共 **39** 个（广州 11 / 佛山 5 / 珠海 3 / 惠州 5 / 江门 7 / 肇庆 8），含官方中心点与官方简化边界 bbox；东莞、中山为不设区的地级市（直筒子市），仅保留市级。运行时不依赖腾讯接口。
- `scripts/seed-regions.ts`：`regionSeedRecords()` 在 9 市 + 深圳完整目录之后追加上述行政区，仍为幂等 upsert；未改 schema、未改运行时读取逻辑。
- 测试：`tests/seed-regions.test.ts` 新增 8 市行政区数量断言；`tests/region-repository.test.ts` 原「广州无下级」改为「广州 11 区 + 东莞无下级」。全量 `npm test` **25 文件 150 测试**通过；`lint` / `typecheck` / `build`（exit 0）全通过。
- 真实库：`npm run backup`（`backups/budget-map-backup-20260913070304.zip`）后 `npm run seed:regions` → regions 83 → **122**（9 城 + 49 区 + 64 商圈）。实时 `GET /api/v1/config?city=` 校验：广州 11 / 佛山 5 / 珠海 3 / 惠州 5 / 江门 7 / 肇庆 8 / 东莞 0 / 深圳 10。
- 尚未做：8 市的**商圈**仍为空（按 `PLAN-REGIONS.md` §4「逐市按数据补齐」后续追加）；行政区 bbox 为官方简化边界取范围，未做精确化。
