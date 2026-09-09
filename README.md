# 街头饭签 · 深圳平价餐食地图

给深圳大学生和科技园上班族的务实吃饭地图。它记录的不是“这家店不错”，而是“这家店的这份饭，哪天核验过，多少钱”。用户端可按深圳全市、9 个行政区 + 大鹏新区及首批常用商圈浏览；地图开放范围不代表已有数据，当前真实数据冷启动仍只聚焦南山区的深大粤海和科技园。仓库已完成阶段 4 的本地可操作演示与交接验收，并完成阶段 5 的受控测试准备：用户端默认使用 DemoMapAdapter，也提供带安全降级的真实腾讯地图路径；后台使用本地 SQLite，匿名投稿、查询码、受控图片处理和审核事务均在本地闭环，不接外部账号或云存储。真实数据采集和真人测试尚未执行。

## 复制粘贴启动

需要 Node.js 20.9 或更高版本（Next.js 16 要求）。

```bash
npm install
# 可选：先配置本机管理员密码（推荐至少 12 个字符）
export ADMIN_PASSWORD='replace-with-a-local-password'
npm run setup
npm run dev
```

然后打开 <http://localhost:3000>。`npm run setup` 会创建 SQLite、运行迁移并幂等导入演示数据；无需申请地图 Key。

阶段 5 的局域网主持入口是 `npm run dev:lan`：它绑定 `0.0.0.0`，并在终端显示本机和同网 IPv4 地址。只可在可信 Wi‑Fi/个人热点使用，测试结束按 Ctrl-C 停止；不要向受试者提供后台地址、管理员密码、数据库或上传目录。手机通过 HTTP 局域网地址时通常无法授予浏览器定位权限，本轮真人任务使用区域选择器并观察回退，定位同意只在主持人电脑的 `localhost` 内部演练。阶段 5 当前仅“准备就绪”，真实数据采集和真人测试待执行，详见 [阶段 5 测试指南](docs/PHASE5_TEST_GUIDE.md)。

没有账号或地图 Key 也可以直接运行 setup；setup 会在被忽略的 `.env.local` 补充随机 32 字节会话密钥，并自动替换过短的弱密钥，但不覆盖已有强密钥。若要生成强密码哈希而不让密码进入 shell 历史：

```bash
npm run admin:password
# 将输出的 ADMIN_PASSWORD_HASH=... 写入 .env.local 后再运行 npm run setup
```

## 怎么看完整流程

- 首页 `/`：默认尝试定位；也可从区域选择器进入“我的附近 → 全城 → 行政区 → 商圈”，再搜索店名或餐食、切换 ¥15 / ¥20 / ¥25、按标签过滤；点击地图上的饭签或右侧列表进入详情。没有真实数据的区域会明确显示“待共建”，不会用演示数据伪装覆盖。
- 地点详情 `/places/shenda-yuehai-canteen`：查看最低价、具体餐食、核验日期、核验方式、准入说明，并可打开第三方导航链接。
- 投稿 `/submit`：匿名提交新饭点、价格、纠错或停业信息；成功页只显示一次随机查询码，并可在 `/submit/status` 查询状态。图片会在服务端重新编码为 WebP、去除元数据并限制最长边，上传失败不会撤回投稿。
- 规则 `/about`：查看收录门槛、180 天新鲜度和可信度说明。
- 后台 `/admin/login`：默认账号为 `admin`，使用 setup 时配置的管理员密码登录（可用 `ADMIN_USERNAME` 改名）；匿名访问其他 `/admin/*` 会重定向登录。登录后可查看真实 SQLite 数据。投稿审核、媒体隐私复核、餐食新增、价格替换、备份、CSV 两阶段导入等写操作都需要签名会话、同源 Origin 和 CSRF 校验，并写入审计记录。通过投稿必须填写独立核验方式、日期和确认项；商户自报不会直接成为公开事实。
- 后台 `/admin/leads`、`/admin/submissions`、`/admin/places`、`/admin/import`、`/admin/exports`、`/admin/audit-log`：分别查看线索、审核投稿、管理地点/餐食/价格、预览并全有或全无导入、生成备份和查看审计。下载的 CSV 模板使用中文列标题，导入时自动转换为内部字段，并兼容旧英文模板；列名和顺序不可修改。同一批中同一地点的多条餐食会归并到一个地点；已存在的疑似重复地点会阻止提交。CSV 仍明确不接收非空的“证据文件名”；阶段 3 图片必须走安全上传链路，不会制造悬挂媒体引用。

## 地图模式与定位

默认的 DemoMapAdapter 是一个无需网络和密钥的“纸上地图”：它能显示饭签点位、切换全市/行政区/商圈视野、点击点位并和列表联动。行政区目录来自深圳现行 9 个行政区 + 大鹏新区；商圈是产品维护的近似矩形范围，不是官方行政边界。设置 `NEXT_PUBLIC_MAP_MODE=tencent` 和 `NEXT_PUBLIC_TENCENT_MAP_KEY` 后，浏览器在线加载腾讯 JS API GL 并绘制自有标记；无 Key、加载失败或 mode=demo 都会明确回退 Demo，不会阻塞页面。不要提交 Key；正式环境需在腾讯控制台配置域名白名单。浏览器定位只用于本页排序与视野，WGS-84 在集中坐标函数中转换为 GCJ-02，不会写入数据库；“我的附近”查询只向服务端发送深圳全市边界，5 公里筛选和距离排序在浏览器内完成。

公开只读接口为 `/api/v1/config`、`/api/v1/map` 和 `/api/v1/places/:id`；投稿接口为 `POST /api/v1/submissions`、`GET /api/v1/submissions/status` 和受令牌保护的媒体上传接口。地图查询支持 `bbox`、`q`、`maxPriceFen`、`zoneId`、`tag/tags`、`sort`（distance 以当前 bbox 中心排序）；最多 500 点，公开饭签价格封顶 ¥25。定位坐标只保留在浏览器当前页面，绝不作为 API 参数发送；只返回 active/open、有效餐食、已核验且不超过 180 天的数据，来源 URL、后台备注、审计、原始 payload、投稿查询码哈希和文件路径不公开。投稿来源按每日轮换盐和服务端密钥生成不可逆指纹；默认只使用 User-Agent，只有设置 `TRUST_PROXY=1` 且可信反向代理已剥离客户端同名头时才读取首个 `x-forwarded-for`。公网部署必须明确代理边界。

## 验证命令

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run backup
npm run maintenance
npm run fresh-start
npm run phase5:check
```

测试会自动使用隔离的临时 SQLite 和文件目录，不会改写默认 `data/budget-map.sqlite`。Playwright 也使用专用测试目录和端口。

`npm run test:e2e` 会在该隔离环境中先构建当前代码，再启动生产模式服务，避免复用旧的 `.next` 产物。

备份会生成 `backups/budget-map-backup-YYYYMMDDHHmmss.zip`，内含 SQLite 一致性快照、关键表（含投稿限流桶）JSON、uploads 和 SHA-256 `manifest.json`。恢复前先做只读校验，并明确输入确认词；阶段 1/2 的 schema-4 备份仍可恢复，应用下次打开数据库时会幂等升级到当前 schema：

```bash
npm run restore -- --from backups/<备份文件>.zip --confirm RESTORE-BUDGET-MAP
```

浏览器验收截图保存在 `artifacts/phase-2/`、`artifacts/phase-3/` 与 `artifacts/phase-4/`。阶段 2 的可视化重点是手机地图与定位降级；阶段 3 验收匿名投稿与后台图片审核；阶段 4 验收 375px 空结果恢复、键盘焦点、后台登录失败提示和无横向溢出。真实腾讯 Key 路径已实现，但本地未配置 Key，未做真实底图现场验证。

从零启动、审核、证据图片、演示数据清理、真实数据导入、备份恢复和故障处理，请先阅读 [本地操作手册](docs/OPERATOR_GUIDE.md)。`npm run fresh-start` 会在临时隔离目录实际执行 setup、公开查询和备份实现，不会碰默认数据目录；它不能替代对刚恢复默认库的实际页面检查。

## 阶段边界

当前阶段已实现 SQLite、版本化迁移、单管理员认证、管理 CRUD、CSV 预览/提交、备份恢复和维护脚本，阶段 2 用户地图与公开查询，阶段 3 匿名投稿、查询码限流、Sharp 安全图片处理、管理员隐私复核和四类审核事务，以及阶段 4 的页面状态、移动/键盘可用性、隔离 fresh-start 验收和非技术操作手册。阶段 5 已完成局域网测试准备、数据核验清单、观察/复盘模板和安全启动入口，但真实数据采集与真人测试待执行。图片默认 `admin_only`，只有权利确认、人工隐私检查完成并关联正式价格事实后才可公开；公开图片只能通过受控媒体路由访问。仍不接外部账号、云存储或公网生产部署，也不提供在线打码编辑器。请先以 `docs/shenzhen-budget-map-system-plan.md` 作为产品和架构边界，再阅读 `docs/DECISIONS.md`、`docs/PROGRESS.md`、`docs/OPERATOR_GUIDE.md` 和 `docs/PHASE5_TEST_GUIDE.md`。
