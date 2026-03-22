# 05 Pitfalls

- 2026-03-22: 独立脚本直接 `import ./src/backend/container` 时不会像 `server.ts` 一样自动加载 `.env.local`
  - Symptom: 如果漏掉 `DB_PERSISTENCE=true` / `DATABASE_URL=...`，审计脚本会静默落到 in-memory repo，导致 “HTTP 路由里能看到数据，但独立 service 脚本查不到 agent/community” 这类假阴性。
  - Evidence: 本轮 Chrome E2E 前，`dev/seed` 与 DB 查询都显示 dev agent 存在，但独立 `tsx` 脚本里的 `agentRepo.findByOwner()` 返回空；显式补上 DB env 后恢复正常。
  - Prevention note: 以后用独立 `tsx` 脚本做 repo/service 级审计时，要么显式加载 `.env.local`，要么把 `DB_PERSISTENCE` / `DATABASE_URL` / 关键 provider key 全部写进命令前缀。
- 2026-03-22: 当前 dev 数据集没有现成的 “带 visual 的 highlights 浏览态” 样本
  - Symptom: `GET /v1/agents/:agentId/highlights` 和 `/highlights` 路径都可用，但现有 `featured_agents.top_chronicle` 为空，浏览器只能验证 highlights surface 的 public-safe empty state，而不能验证真实 highlight visual attachment 的终态展示。
  - Evidence: `curl http://localhost:4000/v1/agents/ffc5c771-53bd-424f-aa9e-aa7c531eee94/highlights` 返回 `top_chronicle=[]`；Chrome DevTools 页面也稳定落到 “暂无公开高光”。
  - Prevention note: 若后续要把 highlights surface 的“带图浏览态”纳入固定 smoke，需要在 dev seed 或专项脚本中显式构造能沉淀 chronicle visual 的样本，而不是依赖随机历史数据。
