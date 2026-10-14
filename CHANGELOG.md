# 变更记录

本项目遵循「一个 PR 一件事」的方式记录；这里只写对外有影响的变更。

## [0.1.0] — 2026-10-14 · 首个公开发布

首次以 MIT 许可开源，一条命令即可自托管。这一版把此前内部开发的应用补齐成可交付的开源项目。

**部署**

- `Dockerfile` + `docker-compose.yml` + `docker/entrypoint.sh` + `scripts/bootstrap.ts`：容器首次启动自动建库、跑迁移、写区域目录与演示数据、生成并持久化 `SESSION_SECRET`、按 `ADMIN_PASSWORD` 初始化管理员。数据落在命名卷 `/data`。
- `npm run preflight`：部署前凭据自查（腾讯地图 Key、大模型 Key、管理员密码、会话密钥、数据目录可写性），四档判定并只回显长度；配置错误时退出码 1。容器首启日志打印同一份清单。
- `.env.example` 收敛为唯一配置文件的模板，逐项写明「缺失后果」；脚本与 Next.js 统一按 `.env.local` > `.env` 的优先级读取。

**演示数据**

- 5 个公开城市约 50 家门店，含常规核验、创作者来源（未核验）、以及**故意不被收录**的两类样本（只有 >¥15 餐食、只有 180 天前价格）。
- 核验日期相对写入时刻，晚部署也不会一片过期；地址带「（演示数据）」，创作者来源为 `示例创作者-*`；存在演示数据时首页显示提示条。

**工程**

- 依赖安全升级：`next` 16.4.0、`sharp` 0.35.5；生产依赖漏洞清零。
- CI：lint / typecheck / test / build（Node 22 + 24 矩阵）、Playwright、Docker 构建 + 容器冒烟；Dependabot 每周检查 npm、每月检查 GitHub Actions 与基础镜像。
- `engines` 要求 Node ≥ 22（Node 20 已于 2026-04 结束维护）。

**文档**

- 面向外部的 README（含英文摘要 `README.en.md`）、架构、配置、部署、数据来源与合规边界、后台手册、新增城市指南、贡献指南、行为准则与安全策略。

[0.1.0]: https://github.com/IamDuXiu/street-food-map/releases/tag/v0.1.0
