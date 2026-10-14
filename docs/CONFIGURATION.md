# 配置说明

只有一个配置文件：**项目根目录的 `.env`**（从 [`.env.example`](../.env.example) 复制）。没有 YAML、没有 JSON、没有数据库里的设置表。

## 谁读这个文件

| 读取方 | 说明 |
|---|---|
| Next.js（站点本体） | 自己加载 `.env` / `.env.local`（`.env.local` 优先），已导出的进程环境变量优先级最高 |
| `docker compose` | 读同目录 `.env` 做变量插值，喂给 `build.args`（`NEXT_PUBLIC_*`）与容器环境 |
| `scripts/` 下的脚本 | 通过 `scripts/load-env.ts` 加载 `.env` / `.env.local`——包括 `npm run preflight`、`collect:web`、`collect:creators`、`bootstrap`、`setup` |

> **优先级**：已导出的进程环境变量 > `.env.local` > `.env`。容器内不复制 `.env`（`.dockerignore` 已排除），环境变量全部由 Compose 传入。

> **写法警示**：不要写 `KEY=`。空字符串是**显式配置**（例如 `DATA_DIR=` 会让程序把当前目录当数据目录）。要覆盖就填真实值，否则保持注释状态。

## 第三方凭据必须由你本人提供

腾讯地图 Key 与大模型 Key 属于**第三方账号凭据**，本项目不内置、不共享任何 Key。

- 腾讯位置服务的 Key 可在控制台绑定**域名白名单**（浏览器端 JS API GL）或 **IP 白名单 / 签名**（服务端 WebService）；
- 大模型 Key 的调用量计入申请者账号的账单与配额。

所以借用他人的 Key 通常既不可行也不合适。想验证仓库干净：

```bash
git grep -nIE "TENCENT_MAP.*KEY\s*=\s*\S|MINIMAX_API_KEY\s*=\s*\S"
```

| 功能 | 需要的凭据 | 不配置的后果 |
|---|---|---|
| 前台地图（默认） | 无 | 使用内置「纸上地图」，无需网络与账号 |
| 前台腾讯真实底图 | `NEXT_PUBLIC_MAP_MODE=tencent`、`NEXT_PUBLIC_TENCENT_MAP_KEY` | 安全回退为内置纸上地图；`preflight` 报配置错误 |
| 后台登录与审核 | `ADMIN_PASSWORD` 或 `ADMIN_PASSWORD_HASH` | 前台照常工作，`/admin` 无法登录，投稿无法审核 |
| 自动地理编码 | `TENCENT_MAP_WEB_SERVICE_KEY`（选填） | 改为人工填写 / 点选坐标 |
| `npm run collect:web` | `MINIMAX_API_KEY`（选填） | 该脚本不可用，站点不受影响 |
| `npm run collect:creators` | `BILIBILI_COOKIE`（选填） | 仍可匿名抓取，更易被限流 |

## 部署前自查：`npm run preflight`

```bash
npm run preflight                      # 严格模式：存在配置错误则 exit 1
npm run preflight -- --warn-only       # 只报告，不失败（容器首启引导用的就是这个模式）
```

它逐项报告「配了什么 / 缺什么 / 缺了会怎样」，并**只回显长度、不打印凭据内容**。判定分四档：

| 档 | 含义 | 例子 |
|---|---|---|
| `✗ error` | 配置错误，必须修（严格模式下 exit 1） | 选了 `tencent` 却没给 Key；`SESSION_SECRET` 短于 32 字符；数据目录不可写 |
| `! warning` | 能启动，但功能会降级 | 未设置 `ADMIN_PASSWORD`（后台无法登录）；配了浏览器端 Key 但模式不是 `tencent` |
| `- optional` | 完全选填，缺了不影响站点 | 未配置 `MINIMAX_API_KEY`、`BILIBILI_COOKIE` |
| `✓ ok` | 已就绪 | — |

容器启动时也会在日志开头打印同一份清单：

```bash
docker compose logs app | head -40
```

## 变量总表

### 后台管理员

| 变量 | 默认 | 说明 / 缺失后果 |
|---|---|---|
| `ADMIN_PASSWORD` | 空 | 首次启动时初始化后台密码（≥12 字符推荐）。**缺失 → 后台无法登录**；只在初始化时使用 |
| `ADMIN_PASSWORD_HASH` | 空 | 已有哈希时优先于 `ADMIN_PASSWORD`。生成：`npm run admin:password` |
| `ADMIN_USERNAME` | `admin` | 后台登录名 |

未提供任何密码配置时：保留库中已有密码；库中也没有则后台无法登录（前台与公开接口不受影响）。改密码后 `password_version` 递增，旧会话自动失效。

### 会话与安全

| 变量 | 默认 | 说明 |
|---|---|---|
| `SESSION_SECRET` | 自动生成 | 后台会话签名 + 匿名来源指纹盐，**≥32 字符**。容器首启自动生成并写入 `/data/.session-secret`（600）；本机由 `npm run setup` 写入 `.env.local`。短于 32 字符视为**配置错误** |
| `TRUST_PROXY` | `0` | **只有**确认可信反向代理会剥离客户端自带的 `X-Forwarded-For` 时才设 `1` |

### 地图

| 变量 | 默认 | 说明 / 缺失后果 |
|---|---|---|
| `NEXT_PUBLIC_MAP_MODE` | `demo` | `demo`（内置纸上地图）或 `tencent` |
| `NEXT_PUBLIC_TENCENT_MAP_KEY` | 空 | 你的腾讯 JS API GL Key（绑定你自己的域名白名单）。**构建期内联**：Docker 部署必须在 build 阶段提供，改完要 rebuild |
| `TENCENT_MAP_WEB_SERVICE_KEY` | 空 | 服务端腾讯 WebService Key：「地址 → GCJ-02 坐标」。缺失 → 人工填坐标（旧别名 `TENCENT_MAP_KEY` 仍可用） |

### 采集脚本（选填）

| 变量 | 说明 |
|---|---|
| `BILIBILI_COOKIE` | 形如 `buvid3=...`，降低 B站 `-412` 限流 |
| `MINIMAX_API_KEY` | `npm run collect:web` 的 LLM Key，按你的账号计费 |
| `MINIMAX_BASE_URL` | 默认 `https://api.minimaxi.com/v1` |
| `MINIMAX_MODEL` | 默认 `MiniMax-M2` |

### 数据与存储

| 变量 | 默认（本机 / 容器） | 说明 |
|---|---|---|
| `DATA_DIR` | `data` / `/data` | 数据根目录 |
| `DATABASE_PATH` | `<DATA_DIR>/budget-map.sqlite` | SQLite 文件路径 |
| `UPLOADS_DIR` | `uploads` / `/data/uploads` | 上传图片目录 |
| `BACKUPS_DIR` | `backups` / `/data/backups` | 备份输出目录 |
| `SEED_DEMO` | `1` | `1` 写入演示门店（本地体验，覆盖 5 城约 50 家，见 README「想看演示数据长什么样」）；`0` 只写区域目录，从空库开始（**生产必须设 0**）。演示门店不是真实店铺，存在时首页会显示演示提示 |
| `HTTP_PORT` | `3000` | 仅供 `docker-compose.yml` 映射宿主机端口 |

## 常见场景

**A. 本地体验（最省事，零凭据）**

```bash
npm install
ADMIN_PASSWORD='local-password-12chars' npm run setup
npm run dev
```

`setup` 会建库、跑迁移、写区域目录与演示数据，并把 `SESSION_SECRET` 写入 `.env.local`；结尾会打印凭据自查清单。

**B. Docker 自托管（默认纸上地图）**

```bash
cp .env.example .env
# 在 .env 中放开并填写 ADMIN_PASSWORD（其余留空即可）
docker compose up -d
docker compose logs app | head -40     # 看凭据自查清单
```

**C. 生产（空库 + 腾讯真实底图 + 自动地理编码）**

`.env`：

```
ADMIN_PASSWORD_HASH=scrypt$...
SESSION_SECRET=<≥32 随机字符>
SEED_DEMO=0
NEXT_PUBLIC_MAP_MODE=tencent
NEXT_PUBLIC_TENCENT_MAP_KEY=<你自己的浏览器端 Key，绑定你的域名白名单>
TENCENT_MAP_WEB_SERVICE_KEY=<你自己的服务端 Key>
TRUST_PROXY=0
```

```bash
npm run preflight              # 先自查，确认没有 error
docker compose up -d --build   # NEXT_PUBLIC_* 变了必须重新 build
```

**D. 局域网演示**

```bash
npm run dev:lan     # 绑定 0.0.0.0，终端打印同网 IPv4 地址
```

只在可信 Wi-Fi / 个人热点下使用；不要把后台地址和密码给受试者。HTTP 局域网地址下浏览器通常不给定位权限，属预期行为。
