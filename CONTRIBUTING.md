# 贡献指南

感谢你愿意帮忙。这个项目很小，维护者是业余时间在做，所以**小而具体的 PR 最容易被合并**。

## 先开 issue 的情况

以下改动请先开 issue 对齐，避免白做：

- 新增城市 / 新增行政区商圈目录（涉及坐标与公开白名单，需要确认口径）
- 改动收录门槛、可信度分级、价格展示规则
- 引入新的运行时依赖，或改动数据模型 / 迁移
- 批量重构（换状态管理、换样式方案、换数据库）

修 bug、补测试、改文档、改无障碍与移动端体验，可以直接提 PR。

## 开发环境

```bash
npm install
export ADMIN_PASSWORD='local-password-12chars'
npm run setup
npm run dev
```

Node.js 20.9+（推荐用 `.nvmrc` 里的 22）。Docker 用户见 README。

## 提交前必须自检

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

涉及 UI / 交互的改动，另外跑一次端到端：

```bash
npx playwright install --with-deps chromium   # 首次
npm run test:e2e
```

`npm test` 与 `npm run test:e2e` 都使用隔离的临时数据库和目录，不会碰你本地 `data/`。

## 代码约定

- **数据层**：页面和 API 路由不直接写 SQL，一律经 `lib/server/` 的 repository / service。
- **迁移**：新增 `db/migrations/NNN_xxx.sql` 后，必须同步 `tests/migrations.test.ts` 的清单与版本断言、`scripts/restore.ts` 的 `CURRENT_SCHEMA`、`scripts/backup.ts` 的关键表清单；迁移事务包裹、文件名前缀即版本号。
- **金额用「分」存储，时间用 UTC，坐标一律 GCJ-02。**
- **安全**：写操作走 `requireAdmin(request, db, true)` + Origin/CSRF 校验 + `recordAudit`；密钥只走环境变量；公开 DTO 不得泄露来源 URL、审核备注、审计记录、原始 payload、文件路径。
- **视觉**：遵循 `docs/UI-GUIDELINES.md`（浅色 foundation、票据式排版、按下反馈）。手势驱动的动效走 `lib/motion.ts` 的弹簧，不要用固定时长动画重造。
- **交互不变量**：正在入场或退场的浮层不得吞掉下一次交互（退场遮罩必须 `pointer-events: none`）。
- **测试**：不得读取 `tmp/`、`outputs/`、`data/`、`backups/` 等被忽略目录——CI 在全新克隆上跑，这类依赖只在你本机能过。需要样本数据请放进 `tests/fixtures/`，且必须是**构造数据**（不含真实门店、价格、链接）。
- TypeScript strict，提交前 Prettier 格式化。

## 数据类贡献（重要）

本项目**不接受**未经核验的批量数据 PR（例如「某城市 200 家店」的清单）。原因：公开数据要能被追溯，只有「有来源 + 有核验方式 + 有日期」的价格才会公开。

如果你想贡献数据，请走产品入口：在部署实例上用 `/submit` 投稿，或经后台 `/admin/creator-import` 逐条人工确认后入库。要贡献**城市目录**（行政区 / 商圈边界），请附上官方或公开可核实的边界来源。

不要抓取小红书、抖音、大众点评（已被实测风控拦截，且违反其条款）。不要提交搬运的创作者视频、封面或全文内容，只允许元数据与外链。

## Commit / PR

- Commit message 用祈使句，一行为主；说明「为什么」而不是重复「改了什么」。
- PR 描述里写清楚：动机、改动范围、验证方式（跑了哪些命令）、有没有影响公开数据口径。
- 一个 PR 只做一件事。混入无关的格式化或重构会被要求拆分。
- 不要提交 `.env*`（`.env.example` 除外）、`data/`、`uploads/`、`backups/`、`outputs/` 里任何内容。

## 行为准则

参与本项目即表示你同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
