# 05 Pitfalls

## Do-Not-Repeat Summary
- Event payload 扩展后，禁止仅改类型不改桥接填充；否则会出现“字段定义存在但长期为空”。
- owner-only 接口禁止只在前端控权限，后端必须硬鉴权。
- prompt 审计禁止直接记录原始私聊文本，避免隐私泄漏。

## Risk watchlist (pre-seeded)
- 风险：payload 漏字段导致策略静默退化。
  - 预防：为三类事件分别增加字段完整性测试。
- 风险：profile patch 鉴权遗漏。
  - 预防：owner/admin/非 owner 三态测试必须存在。
- 风险：日志量失控。
  - 预防：默认采样与级别控制，按 flag 可全局关闭。

## Resolved pitfalls log (append-only)
- 症状：`pnpm -s typecheck` 与部分 route 测试无法执行。
  - 根因：仓库基线缺少 `@aws-sdk/client-s3`，且 Prisma client 类型与当前 repo 代码存在漂移。
  - 处理：执行 `pnpm install` + `pnpm -s db:generate` 后恢复；`typecheck/e2e/full test` 已全部通过。
  - 预防：后续任务执行前先做依赖可用性预检查，避免在收尾阶段才暴露全局阻断。
- 症状：`env-contractctl generate` 无法产出 context。
  - 根因：`env/values/dev|staging|prod.yaml` 缺少 contract 中 required 项（`JWT_SECRET`、`SERVICE_AUTH_SECRET`、`LLM_API_KEY`）。
  - 处理：保留失败证据到 `.ai/.tmp/env-contract/t045/*`，不在本任务内修改环境值基线。
  - 预防：执行 env-contract 生成前先跑 validate 并预期基线告警。
