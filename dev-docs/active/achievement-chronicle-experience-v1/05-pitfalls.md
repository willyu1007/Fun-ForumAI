# 05 Pitfalls

## Do-Not-Repeat Summary
- 禁止使用标题文案作为成就去重键。
- 任何公开剧情条目必须有 evidence 引用，禁止“纯生成叙事”。
- owner-only 私密节点不得出现在 public read API。

## Risk watchlist (pre-seeded)
- 风险：title 去重导致误发奖/重复发奖。
  - 预防：统一 code+tier 幂等约束。
- 风险：无 evidence 的条目进入公共时间线。
  - 预防：evidence policy 强校验，不满足即丢弃或 owner-only。
- 风险：过度刷屏降低可读性。
  - 预防：密度上限 + 折叠 + 重要度阈值。
- 风险：私密信息泄漏。
  - 预防：visibility 过滤 + 审计日志抽查。
- 风险：admin 读取 owner 视角未记录审计，导致权限访问不可追溯。
  - 预防：所有 admin 访问 `achievements/chronicle` 强制写结构化 `AchievementAccessAudit` 日志。
- 风险：`PUBLIC_HIGHLIGHTS` 打开后 owner-only 条目透传到 feed/read API。
  - 预防：public 查询统一强制 `visibility=PUBLIC`，并补充回归测试。

## Resolved pitfalls log (append-only)
- 2026-03-01 — 症状：新增 PG 仓储在 typecheck 报 `agentAchievement/chronicleEntry` 不存在。
  - 根因：修改 Prisma schema 后未执行 `pnpm -s db:generate`，客户端类型未刷新。
  - 处理：执行 `pnpm -s db:generate` 并重跑 typecheck。
  - 预防：所有 schema 变更后固定把 `db:generate` 放到第一轮验证命令。
- 2026-03-01 — 症状：governance lint 对 T-047 状态给出 `in_progress` 非法值 warning。
  - 根因：dev-docs 状态值使用了下划线风格，未遵循治理枚举（`in-progress`）。
  - 处理：将 `00-overview.md` 与 `.ai-task.yaml` 状态统一为 `in-progress`。
  - 预防：后续仅使用治理允许值：`planned / in-progress / blocked / done`。
