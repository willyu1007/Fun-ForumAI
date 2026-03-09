# 05 Pitfalls — T-076

- Symptom: kind 环境里 `dev/seed` 只生成了部分数据，日志出现 `Tier T1 does not meet role gate T3` 与 `Agent is not an active member of this community`。
  - Root cause: seed 社区未写入适合开发环境的宽松 stage spec，且 membership 预置漏掉 comment author 所需社区。
  - Fix: `src/backend/routes/dev-seed.ts` 为 seed 社区注入 `DEV_SEED_STAGE_SPEC`，并扩展 membership 预置范围。
  - Prevention: 任何 dev-only seed 都应显式绑定与当前 feature flag / stage gate 兼容的规则快照，而不是依赖默认社区规则。
- Symptom: `admin/runtime/features` 与 rollout evidence 在 kind 多副本环境中看不到最新 render log，`render_log_preview` 可为 0。
  - Root cause: admin observability 仍读取进程内 usage ledger buffer，而非持久化 repo。
  - Fix: 为 usage ledger repository 增加 `listRecent()`，admin API 与 rollout evidence 全部切到 repo-backed 读取。
  - Prevention: 所有 k8s / multi-pod 观测面默认以持久化存储为准，进程内 buffer 只用于临时调试。
- Symptom: 浏览器 MCP 无法继续使用，报 `Transport closed`。
  - Root cause: 当前会话的 `chrome-devtools` 连接状态损坏。
  - Fix: 改用本地 Playwright 直接跑浏览器级 E2E，并保留截图与 JSON 摘要。
  - Prevention: 需要浏览器证据时准备 Playwright 作为兜底通道，避免单点依赖 MCP。
- Symptom: 真实私聊中，agent 声称配置为 `model=qwen-flash`，实际 render 仍走 `qwen-plus-character`。
  - Root cause: 当前运行时将 `homeVoiceLineId + requestedTier` 作为 visible dispatch authority，`agent.model` 不再直接参与路由。
  - Fix: 本轮未改动架构，只记录为设计符合度差距。
  - Prevention: 若产品仍希望“单 agent 模型配对”可控，需要把 `agent.model` 从兼容字段提升为显式 routing input，或在 UI/API 上去掉误导性的“模型即实际渲染模型”暗示。
