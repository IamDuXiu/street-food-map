# docs/archive — 历史过程记录

这里的文档是项目**开发过程中的工作记录**，保留下来是为了可追溯，**不代表当前状态**，也不建议作为使用或部署依据。

它们记录了产品从「深圳试点」演进到「全国 5 城 · 店级 ≤15 元门槛」的完整过程，包含当时的阶段计划、验收流程、逐条变更流水，以及已经过时甚至相互矛盾的口径。

| 文件 | 是什么 | 当前状态 |
|---|---|---|
| `shenzhen-budget-map-system-plan.md` | 最初的系统方案（深圳试点、阶段 0–5） | 已被 README / `docs/ARCHITECTURE.md` 取代 |
| `PROGRESS.md` | 逐次改动的实施流水 | 停更于归档时点 |
| `DECISIONS.md` | 开发过程中的决策记录 | 同上；仍有参考价值 |
| `IMPLEMENTATION_ANALYSIS.md` | 实施分析 | 同上 |
| `OPERATOR_GUIDE.md` | 早期本地操作手册 | 已由 `docs/ADMIN-GUIDE.md` 取代 |
| `PHASE5_RUNBOOK.md`、`PHASE5_TEST_GUIDE.md` | 局域网真人测试的执行手册与准备清单 | 当时的测试流程，未再使用 |
| `templates/phase5-*.csv`、`phase5-retrospective.md` | 当时的导入模板与观察/复盘表 | 同上 |
| `prototypes/map-first-v1/` | 最早的静态 HTML 原型与配套脚本 | 仅存档，不是现役实现 |

**要读的当前文档**：

- 产品是什么、怎么跑起来 → 根目录 [README.md](../../README.md)
- 架构、数据模型、迁移纪律 → [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
- 环境变量 → [docs/CONFIGURATION.md](../CONFIGURATION.md)
- 部署、备份、上线检查 → [docs/DEPLOYMENT.md](../DEPLOYMENT.md)
- 数据来源与合规边界 → [docs/DATA-SOURCES.md](../DATA-SOURCES.md)
- 后台操作 → [docs/ADMIN-GUIDE.md](../ADMIN-GUIDE.md)
- 界面规范 → [docs/UI-GUIDELINES.md](../UI-GUIDELINES.md)

> 注意：归档文档里仍可能写着「深圳」「阶段 5」「¥25 门槛」「高德地图」等**已废弃**的口径。冲突时一律以代码、README 与上表所列的当前文档为准。
