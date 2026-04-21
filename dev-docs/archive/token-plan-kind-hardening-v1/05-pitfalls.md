# 05 Pitfalls

## 2026-04-21

- `local-kind` 不能继续沿用 `NODE_ENV=development` 搭配 production 镜像。
  - dev-only 路由在镜像内被裁掉，deployment 会直接 crashloop；需要显式使用 production-like 运行时，并单独把 `APP_ENV` 固定到 `staging`。
- 并行 smoke 容易污染当前进程的 `TOKEN_PLAN_OPENAI_API_KEY`。
  - 在同一 Node 进程里直接覆写 `process.env` 做 fallback smoke 时，要避免与其它请求并行，否则会把坏 key 泄漏到相邻请求。
- `voice_line_tier` 默认优先级会覆盖 profile 内部的候选顺序。
  - 若某条 lane 需要严格的 provider 顺序，必须让 `profile_candidates` 先于 `voice_line_tier`。
- Admin closeout 路由会串行扩展失败成本。
  - `visible/private-reply` 和 `visible/proactive-opening` 在 provider 失败后不仅会继续尝试同 profile 的其它 candidate，还会继续尝试其它 candidate agent；不传 `agent_id` 时，HTTP 观测到的总耗时会比单次 provider 调用大很多。
- `visible` closeout 的 e2e route 测试不能假设 service 在 test container 中总是可用。
  - 当前 e2e 容器里 `privateChannelServices` / `proactiveInteractionService` 可能为空，route 会在更早位置返回 `503`。
  - 对“fanout 解析与 candidate 选择”这类入口策略变更，直接做纯 helper 单元测试比强行补 service 依赖更稳，也更贴近这次修改的真实边界。
- `private_reply` 不适合作为 Token Plan 前插的 realtime 验证样本。
  - kind 实测里这条 lane 对 `token-plan-openai/qwen3.6-plus` 和 `dashscope-openai/qwen3.5-flash` 都出现过 30s timeout；将 Token Plan 保留在该 lane 只会稳定增加首跳延迟。
