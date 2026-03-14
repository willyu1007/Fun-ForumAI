# 01 Plan — T-096

## Phase 0 Dependency Lock
Status: completed
1. 继承 `T-094` 的 contract freeze 和 `T-095` 的 selector/metadata 约束。
2. 锁定 chatroom 不再发展第二套长期导演 contract。
3. 锁定 `core / contrast / wildcard` 继续保留，但由 scene recipe 驱动。

## Phase 1 Runtime State Contract
Status: completed
1. 冻结 `runtime_scene_state_v1` 字段。
2. 冻结 `open_loops / resolved_loops / fatigue_score / repetition_score / close_condition` 的职责。
3. 明确 runtime state 与 content metadata / agent runs 的关联关系。
4. 冻结 `RuntimeSceneStateManager` 的信号输入与唯一写权。
5. 冻结 dedicated state table 方案，拒绝 room-local authority sidecar。

## Phase 2 Scene-aware Casting
Status: completed
1. 定义不同 scene template 下的 casting recipe。
2. 明确 `core / contrast / wildcard` 与 scene recipe 的映射。
3. 明确与现有 `CastingDirectorPolicy`、thread guards、spotlight control 的兼容方式。
4. 区分“episode 级 roster shaping”和“turn 级 speaker scoring”。

## Phase 3 Chatroom Adaptor
Status: completed
1. 明确 `RoomProgram`、`RoomEpisodeBeat`、`RoomProgramEvent`、`RoomHighlight` 的统一语义映射。
2. 明确 `ConversationClock / RoomProgramEngine / RoomProjector / RoomProgramProjector` 与共享 contract 的边界。
3. 明确 chatroom 如何消费 `LocalIntent`。
4. 明确 `director_goal` 从 raw free-text 迁移为 `EpisodeBrief -> LocalIntent` 的 compatibility 路径。
5. 冻结 staged cutover，拒绝长期双轨。

## Phase 4 Continuity / Ending / Fatigue
Status: completed
1. 明确 state-driven phase progression。
2. 明确 ending / aftershow / cooldown 的触发条件与 state updates。
3. 明确 continuity seed 与 open/resolved loop 的读写边界。

## Phase 5 Observability And Experiments
Status: completed
1. 定义内容消费指标、agent 养成指标、系统质量指标。
2. 定义 A/B/C 对照实验：
   - 纯自由发挥
   - 规则驱动但无场景池
   - 场景池 + 导演
3. 定义人工节目评审 rubric，验证“更有节目感但不更假”。
4. 冻结 experiment bucket 的 episode-level carrier 与事件采集点。

## Phase 6 Verification
Status: completed
1. runtime state contract 测试计划。
2. scene-aware casting contract 测试计划。
3. chatroom adaptor consistency 测试计划。
4. continuity / ending / fatigue / aftershow state monotonicity 测试计划。
5. 指标可采集性与实验分桶验证计划。

## Risks and mitigations
- 风险：forum 与 chatroom 各自维护 episode/phase 语义，最终形成双重 contract。
  - 缓解：把 `runtime_scene_state_v1` 定义为共享权威对象。
- 风险：chatroom adaptor 直接伤害现有 write path 稳定性。
  - 缓解：继续保留 room program primitives 的兼容外壳，只改变其语义归属。
- 风险：scene-aware casting 与现有 spotlight/guard 机制相互打架。
  - 缓解：保留 `core / contrast / wildcard` 和 thread guards，只让 recipe 提供高层约束。
- 风险：chatroom 继续把 `director_goal` 作为 prompt 主 carrier，导致导演层重新变厚。
  - 缓解：把 `director_goal` 降级为 compatibility 字段，统一改走 `EpisodeBrief -> LocalIntent`。
- 风险：runtime authority 先做 room-local sidecar，后续 forum 复用时再次返工。
  - 缓解：直接采用 dedicated state table，把 shared authority 与 chatroom adaptor 分开。
- 风险：做完 runtime state 仍无法判断用户观感是否变好。
  - 缓解：把指标与实验设计并入本包，而不是留待后补。

## Exit criteria
- chatroom 统一协议方案冻结。
- `runtime_scene_state_v1` 与 scene-aware casting 不再需要二次命名或二次定边界。
- dedicated runtime state table 与 `LocalIntent` staged cutover 已冻结，不再保留 sidecar / 长期双轨 备选。
- 成功标准与实验方案已冻结，后续实现不会在“怎么证明有效”上返工。
