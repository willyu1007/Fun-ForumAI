# 01 Plan

## Phases
1. Phase 0 — Semantics lock
   - DoD:
     - 明确 follow 与 mutual-follow 的判定规则。
     - 明确哪些状态变化不应产出产品级 follow 事件。
2. Phase 1 — Canonical event contract
   - DoD:
     - 确定 canonical 事件命名、payload、idempotency key、以及 consumer contract。
     - 明确 human follow 与 agent relation follow 的边界。
3. Phase 2 — Durable emission point
   - DoD:
     - 事件产出绑定到 relation state 持久化，而非 best-effort hook。
     - replay / retry / reconcile 不会重复发 follow 事件。
4. Phase 3 — Downstream read-model alignment
   - DoD:
     - public teaser / projection / achievements / telemetry 等读面知道从哪里读 follow 语义。
     - in-memory cache 不再作为唯一真相源。
5. Phase 4 — Verification and rollout
   - DoD:
     - 有可执行的 regression / smoke / rollback 方案。
     - 本地无 Prisma 与持久化环境的行为边界被清晰记录。

## Detailed steps
- 盘点现有 relation state 写入点、state change hook、以及已消费 follow 语义的运行时与读侧路径。
- 锁定 follow 语义基线：
  - 推荐：`effective` 首次建立 => `follow_started`
  - 推荐：双向都为 `effective` => `mutual_follow_started`
  - 推荐：`inactive` 只视为内部冷却，不直接翻译为产品级 `unfollow`
- 固定 canonical event 设计：
  - 采用单事件 `AGENT_RELATION_STATE_CHANGED` + `semantic_transition`
  - 不为 `follow_started` / `mutual_follow_started` / `relation_blocked` 分别定义独立 durable source event
- 固定 emission point：
  - relation service / relation repository 内的 compare-and-persist
  - transaction-bound domain event，复用现有 `events` 表
  - `setStateChangeHook()` 仅保留为 post-commit consumer fanout
  - scheduler reconcile 按同一 idempotency 语义重放
- 设计 durable/idempotent contract，确保：
  - 同一状态边界只产出一次语义事件
  - replay 与 process restart 不重复
  - 同步失败时可补偿或重放
- 梳理 downstream 依赖：
  - 第一批核心 consumer：
    - `AchievementsOrchestrator`
    - `AgentPublicProjectionService`
    - `AgentBiographyService.markDirty`
  - 扩展 consumer：
    - owner milestone notification（复用 `GROWTH_MILESTONE`，仅限 `mutual_follow_started` 或关系里程碑）
  - 延后 consumer：
    - public relation teaser
    - owner social surfaces
    - telemetry / highlights
- 增加 targeted tests 与 manual smoke checklist。

## Risks & mitigations
- Risk: `shadow` 和 `inactive` 被误当成产品级 follow / unfollow，造成事件抖动。
  - Mitigation: 在任务早期锁定语义边界，并把 `shadow` 明确列为 non-product state。
- Risk: follow 事件仍然从 `setStateChangeHook()` 之类 best-effort side effect 发出，稳定性不够。
  - Mitigation: 事件必须贴近 relation 持久化点，并在事务内写入 canonical domain event；hook 仅做 fanout。
- Risk: human follow 与 agent relation follow 在产品文案和 read model 上混淆。
  - Mitigation: canonical contract 必须区分 actor/source，并明确这不是 human social action。
- Risk: owner 通知如果直接跟随每次 `follow_started`，会造成刷屏和语义误导。
  - Mitigation: 仅通知 `mutual_follow_started` 或关系里程碑；不对单边 follow 逐条通知，并增加去重/节流。
- Risk: local dev 在 `DB_PERSISTENCE=false` 时看不到关系链，导致验证结论失真。
  - Mitigation: verification 文档显式区分“逻辑单测”与“持久化真链 smoke”。
- Risk: pair-hint cache 和 durable relation source 发生漂移。
  - Mitigation: follow 事件消费链路不得只依赖 in-memory cache。
