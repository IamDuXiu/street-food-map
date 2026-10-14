# 配置说明

所有配置都通过**环境变量**提供，没有配置文件。样例见 [`.env.example`](../.env.example)。

> **两条铁律**
> 1. 不要用「键 = 空值」来「表示默认」。空字符串会被当成显式配置（例如 `DATA_DIR=` 会让程序把项目根目录当数据目录）。要改就填真实值。
> 2. 密钥只放环境变量或 `.env`（已被 `.gitignore` 忽略），**不要提交**。

## 变量总表

### 后台管理员

| 变量 | 默认 | 说明 |
|---|---|---|
| `ADMIN_PASSWORD` | 空 | 首次启动时初始化后台密码（≥12 字符推荐）。只在初始化时使用 |
| `ADMIN_PASSWORD_HASH` | 空 | 已有哈希时优先于 `ADMIN_PASSWORD`。生成：`npm run admin:password` |
| `ADMIN_USERNAME` | `admin` | 后台登录名 |

未提供任何密码配置时：**保留库中已有密码**；若库中也没有，则后台无法登录（前台和公开接口不受影响）。改密码后 `password_version` 递增，旧会话自动失效。

### 会话与安全

| 变量 | 默认 | 说明 |
|---|---|---|
| `SESSION_SECRET` | 自动生成 | 后台会话签名 + 匿名来源指纹盐，**必须 ≥32 字符**。容器首次启动自动生成并写入 `/data/.session-secret`（600 权限）；本机由 `npm run setup` 写入 `.env.local` |
| `TRUST_PROXY` | `0` | **只有**确认可信反向代理会剥离客户端自带的 `X-Forwarded-For` 时才设 `1`（代码取首个 XFF 值，否则可被伪造绕过投稿限流） |

### 数据与存储

| 变量 | 默认（本机 / 容器） | 说明 |
|---|---|---|
| `DATA_DIR` | `data` / `/data` | 数据根目录 |
| `DATABASE_PATH` | `<DATA_DIR>/budget-map.sqlite` | SQLite 文件路径 |
| `UPLOADS_DIR` | `uploads` / `/data/uploads` | 上传图片目录 |
| `BACKUPS_DIR` | `backups` / `/data/backups` | 备份输出目录 |

### 首次启动行为

| 变量 | 默认 | 说明 |
|---|---|---|
| `SEED_DEMO` | `1` | `1` 写入演示门店（本地体验）；`0` 只写区域目录，从空库开始（**生产建议**） |
| `HTTP_PORT` | `3000` | 仅供 `docker-compose.yml` 映射宿主机端口使用 |

### 地图

| 变量 | 默认 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_MAP_MODE` | `demo` | `demo`（内置纸上地图，无需网络与密钥）或 `tencent` |
| `NEXT_PUBLIC_TENCENT_MAP_KEY` | 空 | 腾讯 JS API GL 浏览器端 Key，需在腾讯控制台配置域名白名单 |
| `TENCENT_MAP_WEB_SERVICE_KEY` | 空 | 服务端腾讯 WebService Key：「地址 → GCJ-02 坐标」。留空则后台降级为人工填坐标 |

> ⚠️ `NEXT_PUBLIC_*` 会被 Next.js 在**构建期**内联进客户端包。Docker 部署必须在 build 阶段提供（`docker-compose.yml` 已接好 `build.args`），**运行时再改无效**。选 `tencent` 时请同时保证构建期与运行期值一致（compose 会把同一个 `.env` 值同时给到两处）。

### 采集脚本（可选，只有跑采集时才需要）

| 变量 | 说明 |
|---|---|
| `BILIBILI_COOKIE` | 形如 `buvid3=...`，降低 B站 `-412` 限流；留空走匿名公开请求 |
| `MINIMAX_API_KEY` | `npm run collect:web` 的 LLM 抽取 Key |
| `MINIMAX_BASE_URL` | 默认 `https://api.minimaxi.com/v1` |
| `MINIMAX_MODEL` | 默认 `MiniMax-M2` |

## 常见场景

**A. 本地体验（最省事）**

```bash
npm install
ADMIN_PASSWORD='local-password-12chars' npm run setup
npm run dev
```

`setup` 会：建库 + 跑迁移 + 写区域目录 + 写演示数据 + 生成 `SESSION_SECRET` 到 `.env.local`。

**B. Docker 自托管**

```bash
cp .env.example .env
# 在 .env 中放开并填写：ADMIN_PASSWORD、SESSION_SECRET
docker compose up -d
```

**C. 生产（空库 + 真实地图）**

`.env`：

```
ADMIN_PASSWORD_HASH=scrypt$...        # npm run admin:password 生成
SESSION_SECRET=<≥32 随机字符>
SEED_DEMO=0
NEXT_PUBLIC_MAP_MODE=tencent
NEXT_PUBLIC_TENCENT_MAP_KEY=<浏览器端 Key>
TENCENT_MAP_WEB_SERVICE_KEY=<服务端 Key>
TRUST_PROXY=0                         # 确认代理行为后再改
```

然后 `docker compose up -d --build`（改了 `NEXT_PUBLIC_*` 必须重新 build）。

**D. 局域网演示**

```bash
npm run dev:lan     # 绑定 0.0.0.0，终端打印同网 IPv4 地址
```

只在可信 Wi-Fi / 个人热点下使用；不要把后台地址和密码给受试者。HTTP 局域网地址下浏览器通常不给定位权限，属预期行为。

## 配置加载顺序

Next.js 自身按 `.env.local` → `.env` 的顺序加载，**已存在的进程环境变量优先**（`.env` 不会覆盖 shell 里 export 的值）。脚本（`tsx scripts/*.ts`）只读取进程环境变量，其中 `scripts/setup-demo.ts` 会额外读取根目录 `.env.local`。
