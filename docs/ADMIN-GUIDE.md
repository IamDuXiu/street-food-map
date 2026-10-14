# 后台操作手册

给部署者、审核人员用。后台入口 `/admin/login`，默认用户名 `admin`，密码是首次初始化时设置的那个。

> 后台是给**部署者自己**用的工具：只有单管理员，没有用户体系。不要把 `/admin` 暴露给不信任的人。

## 从零启动

```bash
npm install
ADMIN_PASSWORD='请替换为强密码' npm run setup   # 建库 + 迁移 + 区域目录 + 演示数据
npm run preflight                              # 凭据自查：缺什么、缺了会怎样
npm run dev
```

- 前台：<http://localhost:3000>
- 后台：<http://localhost:3000/admin/login>

`setup` 会幂等创建/升级 `data/budget-map.sqlite`、`uploads/`、`backups/`，并把随机会话密钥写入 `.env.local`。**不要把 `.env.local`、数据库、备份发给别人。**

腾讯地图 Key、大模型 Key 这类第三方凭据必须是你自己账号申请的值：仓库不内置任何 Key，`npm run preflight` 会逐项告诉你**当前配了什么、缺什么、缺了哪个功能会降级**（只看长度，不回显凭据内容）。

改密码（不落 shell 历史）：

```bash
npm run admin:password     # 输出 ADMIN_PASSWORD_HASH=...
# 写入 .env.local 后重启；旧会话自动失效
```

自检：`npm run fresh-start` 会在系统临时目录里用同一套 setup / 公开查询 / 备份实现跑一遍完整初始化，然后清理，不影响你的 `data/`。

## 页面一览

| 页面 | 用途 |
|---|---|
| `/admin` | 总览 |
| `/admin/leads` | 线索池：采集/导入产生的候选，逐条处理 |
| `/admin/creator-import` | 粘贴采集 JSON → 预览 → 补坐标 → 提交 |
| `/admin/submissions` | 审核匿名投稿 |
| `/admin/places` | 地点 / 餐食 / 价格管理 |
| `/admin/import` | CSV 两阶段导入（下载模板 → 预览 → 提交） |
| `/admin/regions` | 区域目录（商圈增删改） |
| `/admin/exports` | 导出与备份 |
| `/admin/audit-log` | 审计记录 |

所有写操作都需要签名会话 + 同源 Origin + CSRF 校验，并写入审计记录。

## 日常审核

- 用户在 `/submit` 匿名提交四类信息：新地点、价格变化、地点纠错、停业。成功页只显示一次查询码（仅用于 `/submit/status` 查状态，不能当图片上传令牌）。
- 在 `/admin/submissions` 打开投稿：先看类型化字段、证据缩略图、权利确认与人工隐私状态，再选「通过 / 待核验 / 重复 / 拒绝」。**待核验或失败不会改变正式公开数据。**
- 只有 `new_place` 和 `new_price` 的证据可以在批准时勾选公开；纠错与停业的证据始终后台私有。公开图片必须已完成权利确认 + 隐私复核，并关联到正式核验价格。
- 图片含姓名、电话、订单号、二维码、人脸等敏感信息时：保持 `admin_only`，或上传人工脱敏后的替代图（替代图仍需重新检查；原图不删除、不公开）。
- 新价格可以记录高于 ¥15 的涨价；**公开地图按店级门槛**收录（店内至少一份 ≤¥15 单人餐），其余餐食如实展示，sanity 上限 ¥200。

## 导入真实数据

`/admin/import` → 先「下载 CSV 导入模板」→ 填好后上传 → 预览 → 提交，全过程不需要改代码。

- 模板列标题是中文，**不要改名、增删或调整顺序**（旧英文模板仍可导入）。
- 坐标填 **GCJ-02**，金额以**元**填写，观察日期不能是未来。
- 同一批次里同一地点的多条餐食会归并到一个地点；已存在的疑似重复地点会阻止提交。
- CSV **不接收图片路径**，也不会自动制造证据媒体；图片必须走投稿或后台安全上传链路。

**演示数据清理警告**：不要直接删除默认数据库、`uploads/` 或 `backups/`。先 `/admin/exports` 或 `npm run backup` 生成备份并校验，再用一个明确的**新** `DATA_DIR` / `UPLOADS_DIR` 跑正式数据；或由熟悉 SQLite 的人在停机后处理。误删时：停服务 → 保留现场 → 从备份恢复，不要继续写入。

## 备份与恢复

```bash
npm run backup
npm run restore -- --from backups/<文件>.zip --confirm RESTORE-BUDGET-MAP
```

备份包含一致性 SQLite 快照、关键表、投稿/审核记录、媒体文件与 SHA-256 清单。恢复是覆盖操作：先停写入、先做只读校验；命令会先自动备份当前数据，且必须输入确认词。恢复失败会保留原库与原上传目录。

验证恢复结果要**启动应用实际检查**：公开地图、投稿、公开媒体、`/admin` 数据，然后跑 `npm run maintenance`。`npm run fresh-start` 只验证「软件能否从零初始化」，不能验证刚恢复的默认库。

更多部署侧内容（HTTPS、反向代理、定时备份、上线检查清单）见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 采集怎么用

```bash
npm run collect:creators     # B站 + 可选 YouTube → outputs/creator-collect.json
npm run collect:web          # 搜索引擎 + LLM → outputs/web-collect.json（需 MINIMAX_API_KEY）
```

产出 JSON 后进 `/admin/creator-import` 粘贴、预览、逐条确认坐标、提交。采集只做发现，详见 [DATA-SOURCES.md](DATA-SOURCES.md)。

## 常见故障

- **页面打不开**：确认服务还在跑；端口被占用时停掉旧进程或换端口，**不要删数据库**。
- **无法登录**：确认用的是初始化时的密码；`SESSION_SECRET` 是否 ≥32 字符且没变（容器里它存在 `/data/.session-secret`）。
- **投稿图片失败**：保留成功页查询码；页面会列出失败数量并允许重试。只接受 JPEG/PNG/WebP，单张 ≤10MB，每次投稿 ≤5 张。
- **地图显示内置地图**：无 Key / 加载失败时的正常降级。腾讯 JS API GL 需要在**构建期**配置 `NEXT_PUBLIC_*`。
- **导入被拒**：看逐行预览，修正坐标系统、日期、金额、重复地点或来源字段后重新选文件。确认按钮只在整批通过时出现。
- **e2e 报 IPC 权限错误**：受限沙箱不允许创建临时 socket；在普通终端重跑 `npm run test:e2e`，不要关掉校验。

## 安全底线

管理员密码、`SESSION_SECRET`、数据库、备份与上传目录只保存在受控环境。不要把来源 URL、审核备注、投稿原始内容、查询码哈希或文件路径复制到公开页面或截图里。公网接入前请按 [SECURITY.md](../SECURITY.md) 的自查清单逐项确认。
