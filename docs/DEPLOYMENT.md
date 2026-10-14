# 部署指南

街头饭签是**有状态**应用：需要一个常驻 Node.js 进程 + 一块持久磁盘（SQLite、上传图片、备份都在上面）。任何能跑 Docker 或 Node 的地方都能自托管；不需要外部数据库、对象存储或账号体系。

- **不能用**纯静态托管（GitHub Pages、纯 CDN）：没有服务端就没有 SQLite、投稿、图片处理与后台。
- **不适合**无持久卷的 serverless（如 Vercel 默认环境）：SQLite 会随实例销毁。要用也行，但得先把数据层换成外部数据库。
- 环境变量清单见 [CONFIGURATION.md](CONFIGURATION.md)；上线前请过一遍 [SECURITY.md](../SECURITY.md#部署者自查清单)。

## 第 0 步：准备你自己的第三方凭据

**部署前先看一眼这一步。** 项目的第三方凭据（腾讯地图 Key、大模型 Key）必须用**你自己账号**申请的：

- 仓库与镜像里**不包含任何 Key**，也没有公共 Key 可供共用；
- 借用他人的 Key 通常不可行：腾讯位置服务的 Key 可绑定**域名白名单**（浏览器端）或 **IP 白名单**（服务端）；大模型 Key 的调用量计入申请者账号的账单与配额。

两个方向自己选：

| 你的目标 | 需要准备 |
|---|---|
| 先跑起来看看（默认纸上地图 + 5 城演示数据，零凭据） | 只要一个 `ADMIN_PASSWORD`（否则后台无法登录） |
| 用腾讯真实底图 | 追加 `NEXT_PUBLIC_MAP_MODE=tencent` + 你自己的 JS API GL Key（绑定你的域名白名单） |
| 后台自动把地址转坐标 | 追加 `TENCENT_MAP_WEB_SERVICE_KEY`（选填；不配就人工填坐标） |
| 跑网页采集 | 追加 `MINIMAX_API_KEY`（选填；按你的账号计费） |

**配置只有一个文件**：项目根目录的 `.env`（从 [`.env.example`](../.env.example) 复制）。逐项后果都写在模板注释里。

**部署前自查**：

```bash
# 本机（需要先 npm install 才有 tsx）
npm run preflight            # 严格模式：配置错误则 exit 1
npm run preflight -- --warn-only

# 已经在用 Docker 的
docker compose up -d
docker compose logs app | head -40   # 日志开头就是同一份清单
```

`preflight` 会明确区分「配置错误（必须修）」「警告（功能降级）」「选填」，并且只回显凭据长度、不打印内容。常见结果示例：

- `✗ 选了 tencent 却没有浏览器端 Key` → 要么填 Key，要么把 `NEXT_PUBLIC_MAP_MODE` 改回 `demo`；注意 `NEXT_PUBLIC_*` 是构建期内联，改完必须重新 build。
- `! 未设置 ADMIN_PASSWORD` → 站点能跑，但 `/admin` 登不进去、投稿无法审核。

## 没有服务器和域名怎么办

先给结论：**不买服务器、不买域名也能跑在线 demo，但「零成本 + 长期在线 + 有 HTTPS」三件事不能同时满足**，需要挑一个取舍。下面按推荐顺序列出，并写清每种的代价。

### 先弄清三条硬约束（会决定你选哪条路）

1. **后台登录必须有 HTTPS**。生产模式下会话 Cookie 带 `Secure` 标记（`lib/server/auth.ts` 的 `setSession`），浏览器在纯 HTTP 页面下不会把它存下来/发回去，所以用 `http://IP:3000` 直连时**前台能用、后台登不进去**。
2. **「我的附近」定位也需要安全上下文**（HTTPS 或 localhost）。纯 HTTP 下定位会被浏览器拒绝，用户只能走区域选择器（有兜底，不算坏，但不是完整体验）。
3. **反向代理不能改写 `Host` 而不改 `Origin`**。写操作校验 `new URL(origin).host === host`，两条同时被改写（例如隧道）没问题，只改一条会 403。

### 方案 A：自己已有的机器 + Cloudflare 隧道（零成本，推荐先试）

不需要域名、不需要备案、不需要公网 IP、不用开端口，命令行一条：

```bash
# 先在本机把服务跑起来（生产模式）
ADMIN_PASSWORD='一次性强密码' SESSION_SECRET="$(openssl rand -base64 32)" npm run setup
npm run build && npm run start          # 或 docker compose up -d

# 再开一个免费隧道（无需 Cloudflare 账号）
cloudflared tunnel --url http://localhost:3000
```

终端会打印一个 `https://<随机串>.trycloudflare.com` 地址，直接分享给别人即可。HTTPS 自动具备，所以**后台登录与定位都能用**。

要注意的代价（官方定位就是测试/预览，不是生产）：

- **没有可用性保证**；机器关机、隧道进程退出，站点就没了；
- **每次启动 URL 都会变**（想固定 URL 就得用命名隧道 + 自己的域名）；
- 单个隧道约 200 并发请求，不支持 SSE；
- 不想让所有人看，可以加 `--allowed-mail '@你的邮箱域'` 限制访问（cloudflared ≥ 2026.9.3）；
- **公开暴露时请用一次性强密码**，不要复用正式后台的密码——`/admin/login` 是公开可达的（有失败锁定，但没必要冒险）。

### 方案 B：一台便宜 VPS，IP 直连（不买域名）

拿到公网 IP 后按「方式二：裸机 + systemd」部署，访问 `http://<IP>:3000`。**前台完整可用**（地图、列表、详情、投稿都能用），但按上面第 1、2 条，**后台登录与定位不可用**。

想要 HTTPS 又不想买域名，就在 VPS 上再套一层方案 A 的隧道；或者买域名（国内服务器还需 ICP 备案）。

### 方案 C：托管平台（月付几美元，最省心）

平台会给你 `*.fly.dev` 之类的子域名与自动 HTTPS，不需要买域名、不需要备案：

- **必须有持久卷**：SQLite、`uploads/`、`backups/` 都要落在卷上（`DATA_DIR` 指向卷），否则每次重新部署数据全丢。
- **Render 的免费 Web Service 不能挂持久盘**（官方文档明确列出），免费实例还会 15 分钟无流量休眠——**不适合这个应用**。
- Fly.io 新账号没有免费额度（约 $5/月 Hobby），Railway 约 $5/月，Northflank 有免费 Developer 计划（两个常驻服务）。价格与政策会变，请以各平台当时的定价页为准。
- 云端建议设 `SEED_DEMO=1`（保留演示提示条），或干脆用 `SEED_DEMO=0` 上一个真实但空白的实例。

### 方案 D：不做在线实例

README 里已有三张真实截图（含切换城市与移动端形态），加上「一条命令自托管」，想评估的人本地五分钟就能看到完整体验。**没有在线 demo 不影响这个项目可用**，只是少了一个「点进去就看」的入口。

### 上线前（无论选哪条）

仍然要过一遍本文的[上线检查清单](#上线检查清单)；公开 demo 额外注意：`SEED_DEMO` 符合你的意图（首页有没有「演示数据」提示条）、后台密码是一次性的、`SESSION_SECRET` 不是临时值。

## 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/IamDuXiu/street-food-map.git
cd street-food-map
cp .env.example .env
```

编辑 `.env`（Docker Compose 会自动读取同目录 `.env` 做变量插值）：

```
ADMIN_PASSWORD=change-me-to-a-long-password
SESSION_SECRET=<32 位以上随机字符串>
```

启动：

```bash
docker compose up -d --build
docker compose logs -f app        # 开头是凭据自查清单，之后是引导日志
```

打开 `http://<服务器地址>:3000`，后台入口 `/admin/login`。

**容器启动时会发生什么**（`docker/entrypoint.sh` → `scripts/bootstrap.ts`，幂等）：

1. 创建 `/data`、`/data/uploads`、`/data/backups`；
2. `SESSION_SECRET` 未提供时自动生成并持久化到 `/data/.session-secret`（重启不会踢掉登录态）；
3. 打开数据库 → 自动应用所有未执行的迁移；
4. 按 `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH` 初始化管理员密码；
5. 写入区域目录；
6. `SEED_DEMO` 不为 `0` 时写入演示门店。

数据都在命名卷 `street-food-map-data` 的 `/data` 下，`docker compose down` 不会删；**`docker compose down -v` 会删掉全部数据**。

**换地图**：在 `.env` 里设 `NEXT_PUBLIC_MAP_MODE=tencent` 与 `NEXT_PUBLIC_TENCENT_MAP_KEY=...`，然后 `docker compose up -d --build`（`NEXT_PUBLIC_*` 是构建期内联，改完必须 rebuild）。

**换端口**：`HTTP_PORT=8080` 写进 `.env`。

## 方式二：裸机 + systemd

```bash
git clone https://github.com/IamDuXiu/street-food-map.git /srv/street-food-map
cd /srv/street-food-map
npm ci
npm run build
```

`/etc/street-food-map.env`（`chmod 600`，属主为运行用户）：

```
NODE_ENV=production
PORT=3000
DATA_DIR=/var/lib/street-food-map
UPLOADS_DIR=/var/lib/street-food-map/uploads
BACKUPS_DIR=/var/lib/street-food-map/backups
DATABASE_PATH=/var/lib/street-food-map/budget-map.sqlite
SESSION_SECRET=<32 位以上随机字符串>
ADMIN_PASSWORD_HASH=scrypt$...
SEED_DEMO=0
```

`/etc/systemd/system/street-food-map.service`：

```ini
[Unit]
Description=Street Food Map
After=network.target

[Service]
Type=simple
User=streetfood
WorkingDirectory=/srv/street-food-map
EnvironmentFile=/etc/street-food-map.env
ExecStartPre=/usr/bin/npx tsx scripts/bootstrap.ts
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=3
# 收紧权限（按需调整）
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/street-food-map

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now street-food-map
```

`ExecStartPre` 里的 `bootstrap.ts` 负责迁移与区域目录；只需要守护进程，不需要 cron。

> `/usr/bin/npx`、`/usr/bin/npm` 是常见路径，但用 nvm / fnm 安装的 Node 会不同——请把上面 unit 里的路径换成 `which npx` / `which npm` 的实际输出，或直接写成你 Node 可执行文件的绝对路径。

## 反向代理与 HTTPS

浏览器定位与安全 Cookie 都需要 HTTPS。以 nginx 为例：

```nginx
server {
  listen 443 ssl http2;
  server_name map.example.com;

  ssl_certificate     /etc/letsencrypt/live/map.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/map.example.com/privkey.pem;

  client_max_body_size 12m;        # 投稿图片单张上限 10MB

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

**关于 `TRUST_PROXY`**：默认是 `0`。只有在你确认代理会**覆盖/剥离**客户端自带的 `X-Forwarded-For`（上例用 `proxy_set_header` 覆盖即可）时，才设 `TRUST_PROXY=1`。否则伪造请求头可以绕过投稿限流指纹。

代理**不要**改写 `Host` 或 `Origin`，否则后台写操作的 Origin 校验会失败。

## 备份与恢复

```bash
npm run backup      # 生成 backups/budget-map-backup-YYYYMMDDHHmmss.zip
```

备份包含一致性 SQLite 快照、关键表 JSON、`uploads/` 媒体文件与 SHA-256 `manifest.json`。

恢复是**覆盖操作**，务必先停服务：

```bash
npm run restore -- --from backups/<文件>.zip --confirm RESTORE-BUDGET-MAP
```

恢复前会做只读校验，并自动先备份当前数据；失败时保留原库与原上传目录。

定时备份（宿主机 cron，建议先落在本机再同步到异地）：

```cron
0 4 * * * cd /srv/street-food-map && npm run backup >> /var/log/street-food-map-backup.log 2>&1
```

Docker 部署可以从卷里取：

```bash
docker compose exec app sh -c 'npx tsx scripts/backup.ts'
docker cp street-food-map:/data/backups/<文件>.zip ./
```

**每月做一次恢复演练**（恢复到隔离目录或临时容器），确认备份真的可用。

## 升级

```bash
git pull
npm ci                 # 本地部署
npm run build
sudo systemctl restart street-food-map        # 或 docker compose up -d --build
```

升级前先 `npm run backup`。数据库迁移会在下次启动时自动执行；迁移只前进不回滚，回退版本请用备份恢复。

## 平台速查

| 平台 | 可行性 | 说明 |
|---|---|---|
| 任意 VPS / 家庭服务器 | ✅ 推荐 | Docker 或裸机都行，最省心 |
| Fly.io / Railway / Render | ✅ | 必须挂**持久卷**并把 `DATA_DIR` 指向卷；注意平台代理行为后再决定 `TRUST_PROXY` |
| 腾讯云 / 阿里云轻量 | ✅ | 国内访问最稳；绑域名需 ICP 备案 |
| Vercel / Netlify Functions | ❌ | 无持久文件系统，SQLite 不可用 |
| GitHub Pages | ❌ | 纯静态，无服务端 |

## 上线检查清单

- [ ] `SEED_DEMO=0`，且演示数据没有混进正式库（首页不应出现「演示数据」提示条）
- [ ] `npm run preflight` 无 `✗` 配置错误（见 [CONFIGURATION.md](CONFIGURATION.md)）
- [ ] 所有第三方凭据都是你自己账号申请的（腾讯地图 / 大模型），未借用他人 Key
- [ ] `SESSION_SECRET` ≥32 字符随机值，未进 Git / 镜像层 / 日志
- [ ] 用 `ADMIN_PASSWORD_HASH` 而非明文密码；明文的 `ADMIN_PASSWORD` 只在初始化时用过一次
- [ ] `SEED_DEMO=0`，正式库与演示数据分离
- [ ] HTTPS 已启用；Cookie 正常
- [ ] `TRUST_PROXY` 的取值有依据（实测过代理行为）
- [ ] `data/`、`uploads/`、`backups/` 不可通过 Web 直接访问
- [ ] 备份任务已配置，且做过一次 `restore` 演练
- [ ] 公开接口自查：`source_url`、审核备注、审计、原始 payload、文件路径均取不到
- [ ] 腾讯 Key 已配置域名白名单
- [ ] 定期跑 `npm run maintenance`

## 故障排查

| 现象 | 排查 |
|---|---|
| 首页打不开 | 容器/进程是否在跑；端口是否被占用；看 `docker compose logs` |
| 后台登录失败 | 密码是否与初始化时一致；`SESSION_SECRET` 是否 ≥32 字符且跨重启稳定 |
| 地图显示成了内置地图 | 这是无 Key / 加载失败时的正常降级；检查 `NEXT_PUBLIC_MAP_MODE` 是否在**构建期**就设为 `tencent` 且 `NEXT_PUBLIC_TENCENT_MAP_KEY` 是你自己的 Key（`npm run preflight` 会直接告诉你缺哪一项） |
| 日志开头出现 `✗` 开头的配置错误 | 按该行 `↳` 提示修正后重启；`✗` 表示配置自相矛盾（例如选了腾讯底图却没有 Key、`SESSION_SECRET` 太短、数据目录不可写） |
| 后台打不开 / 登录不了 | 先看是否设置了 `ADMIN_PASSWORD`（`preflight` 会报 `!` 警告：站点能跑但后台不可用）。若登录页提示「本实例还没有设置管理员密码」，就是这一项没配；该提示不会计入失败锁定，填上后重启即可 |
| 腾讯底图不生效、Key 像是没用 | `NEXT_PUBLIC_*` 在构建期内联：改完必须重新 build（`docker compose up -d --build`）；另外确认 Key 在腾讯控制台绑定了**你自己的域名**白名单 |
| 投稿写操作被拒 | 反向代理是否改写了 `Host` / `Origin` |
| 投稿图片上传失败 | 只接受 JPEG/PNG/WebP，单张 ≤10MB，每投稿 ≤5 张；服务端会重编码为 WebP |
| 后台登录后立即掉线 | 容器重建导致数据卷丢失（`/data/.session-secret` 与数据库会一起没） |
| 数据不见了 | 检查是否用了 `docker compose down -v`；从 `backups/` 恢复 |
