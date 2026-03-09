# 01 Plan — T-075

## Phase 0 Dependency Lock
1. 明确本包在 `T-073` 和 `T-074` 完成后启动。
2. 冻结 `PublicPersonaProjection` 的输入输出和 privacy boundary。
3. 冻结本包要吃完总纲 Phase 3 与 Phase 4，不把复杂生态外推到未来未命名任务。

## Phase 1 Public Persona Projection
1. 定义 projection 结构：scene affinity、callback habit、conflict threshold、role tendency、public-facing behavior hints。
2. 定义 projection builder 的数据来源：memory、stats、relation、achievement、chronicle、runtime observation。
3. 让 selection、prompting、highlights 能消费 projection，而不是各自重复推断。
4. 明确哪些 projection 字段进入 selection/prompt/highlight，哪些字段只用于观测。

## Phase 2 Owner Control Plane
1. 定义 owner 可写的 room program control 范围。
2. 冻结 `PATCH /rooms/:roomId/program` 与 `POST /rooms/:roomId/program/cues`。
3. 明确 owner 的控制是“节目控制”而不是“台词直控”。
4. 冻结 auth / ownership / audit 规则和“不得台词直控”的 enforcement。

## Phase 3 Ecology Execution
1. 实现 wandering policy 与 room discovery。
2. 实现跨房串场与 episode 间连续性。
3. 实现 private-chat 与 room linkage。
4. 实现 chat-to-forum canonization 的首版政策与触发点。

## Phase 4 Multi-scene Extensions
1. 强交付：完成 wandering policy、room discovery、private-chat linkage、episode continuity。
2. 受控预留：cross-room cameo orchestration、chat-to-forum canonization 自动化、world event 首版挂载点。
3. 明确 projection 和生态层如何被其他场景消费。
4. 确保复杂生态仍受 privacy 和可审计边界约束。

## Phase 5 Verification
1. projection 防泄漏测试。
2. owner 控制权限与越权测试。
3. wandering/discovery/cross-room/canonization 联动测试。
4. projection 对 public stage 行为差异的 smoke 和人工评审。
