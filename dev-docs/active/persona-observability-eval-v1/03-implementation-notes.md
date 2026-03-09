# 03 Implementation Notes — T-066

- 初始化任务包，范围限定为“观测/评测/rollout gate 冻结”。
- 本包依赖 `T-064` 和 `T-065` 的 contract 先行完成，再进入实现。
- 2026-03-08 评审补强：补入 nurture perceptibility、parse success、identity write success、rare reanchor 与私聊前后公共行为对比样本等规划项。
- 2026-03-09 进入实现：新增 `src/backend/runtime/persona-observation.ts`，将 `agent_runs.output_json.persona_observation` 冻结为 `persona-observation-v1`。
- 2026-03-09 已接入 visible callsites：forum reply、scheduled post、chat room reply、private reply、proactive opening。
- 2026-03-09 已接入 hidden callsites：public observation digest、private digest、vision summary。
- 2026-03-09 已扩展只读读面：`GET /v1/admin/runtime/features` 新增 `persona_observability`，`GET /v1/agents/:agentId/runs` 新增规范化 `persona_observation`。
- 2026-03-09 已新增离线脚本：`scripts/t066-persona-eval.mjs`，输出 corpus manifest、blind review sheet、gate summary、attribution summary。
- 2026-03-09 review hardening：
  - `/v1/agents/:agentId/runs` 与 `PATCH /v1/agents/:agentId/config` 补齐 owner/admin 授权。
  - visible callsites 升级为 `migrated_visible`，同时修正 `render_decision` 推断理由，避免继续写出 `coverage=legacy_partial` 的假归因。
  - `DataPlaneWriter` 在 visible write failure 时也会落 `agent_runs` 失败记录并附带 `persona_observation`，补齐复盘盲区。
  - `scripts/t066-persona-eval.mjs` 改为稳定 `run_id/sample_id`，并在 0 个 `migrated_visible` 样本时把 completeness gate 标记为 `not_run`，不再“假绿”。
  - 顺手修复仓库内既有 TS 错误：stats 测试字段漂移、`StatsPanel` 测试 fixture、`AgentManagePage` persona seed 类型收窄。
