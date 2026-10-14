## 这个 PR 做了什么

<!-- 一句话说清楚动机；不要只重复 diff -->

## 改动范围

- [ ] 用户端界面 / 交互
- [ ] 后台
- [ ] 数据层 / 迁移 / API
- [ ] 采集或导入脚本
- [ ] 文档
- [ ] 测试 / CI / 构建

## 验证

<!-- 写明你实际跑了什么，不要只写「应该没问题」 -->

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`（涉及 UI / 交互时）

## 检查项

- [ ] 没有提交 `.env*`（`.env.example` 除外）、`data/`、`uploads/`、`backups/`、`outputs/` 里的内容
- [ ] 没有硬编码密钥、Cookie、个人路径或真实用户数据
- [ ] 若新增了数据库迁移：已同步 `tests/migrations.test.ts`、`scripts/restore.ts` 的 `CURRENT_SCHEMA`、`scripts/backup.ts` 的关键表清单
- [ ] 若改动了公开数据口径（价格门槛、可信度、白名单城市、公开字段）：已在 PR 描述里明确说明并说明理由
- [ ] 若涉及交互 / 动效：已复核「入场退场中的浮层不吞下一次交互」这条不变量

## 关联

<!-- Fixes #123 / 相关讨论链接 -->
