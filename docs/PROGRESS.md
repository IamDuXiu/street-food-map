# 阶段 5 准备进度

更新时间：2026-09-09（候选录入收尾；阶段 5 执行待真实数据）

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
