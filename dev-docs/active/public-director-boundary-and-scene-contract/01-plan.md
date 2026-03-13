# 01 Plan — T-094

## Phase 0 Decision Lock
Status: completed
1. 接受用户已确认的统一原则：公域导演、私域非导演、热点走 overlay、角色只拿 `LocalIntent`。
2. 确认本包为 planning-only bundle，不实现 runtime code。
3. 确认本包不复用旧 task，而是作为 `F-060 / R-060 / T-094` 的新起点。

## Phase 1 Boundary Freeze
Status: in-progress
1. 明确 `forum / chat_room / scheduled_post` 的导演职责边界。
2. 明确 `private_chat / proactive_dm` 的排除范围与例外处理。
3. 产出 public/private boundary matrix。
4. 固定 `director_surface / actor_surface / private_surface` 词汇。

## Phase 2 Contract Surface
Status: in-progress
1. 冻结 `stage_template_v2.director` 字段。
2. 冻结 `scene_binding_v1`、`episode_overlay_v1`、`runtime_scene_state_v1`。
3. 冻结 `EpisodeBrief`、`LocalIntent`、`scene_metadata`。
4. 冻结 `PrivateChatContext` 与 `ProactiveDmOpeningContext`。
5. 冻结 feature flag / rollout matrix 命名建议。

## Phase 3 Asset And Ops Mapping
Status: planned
1. 把现有 `docs/stage-templates/v1/**`、manifest、rotation、validate、atomic publish/rollback 链路映射到新 scene-pool 合同。
2. 冻结 template 生命周期：`draft / hidden / canary / active / retiring / archived / blocked`。
3. 标注哪些能力后续由实现侧直接升级，哪些只需兼容承接。

## Phase 4 Private Boundary Remediation
Status: planned
1. 列出 `private_chat` 与 `proactive_dm` 当前残留 director/showrunner 语义入口。
2. 冻结 owner 回复后退回 plain private chat 的执行边界。
3. 产出 private/proactive remediation matrix 与负向验证要求。

## Phase 5 Legacy Mapping
Status: planned
1. 把 `StageSpec`、现有 stage templates、`PromptOrchestrator.layer_showrunner`、chatroom program primitives、private channel context 映射到新合同。
2. 标注可复用、需增强、需收口三类模块。
3. 冻结 migration 和 rollback 原则。

## Phase 6 Handoff
Status: planned
1. 交付给 `T-095` 的 selector / scheduled_post / forum 前置契约。
2. 交付给 `T-096` 的 runtime state / chatroom adaptor 前置契约。
3. 记录 feature flags、私域收口顺序与资产层升级顺序。

## Risks and mitigations
- 风险：继续把导演层和 persona runtime 混成一个对象。
  - 缓解：强制保留 `StageSpec` 独立治理角色，并把 `LocalIntent` 作为角色侧唯一导演输入。
- 风险：私聊仍通过 `layer_showrunner` 或 episode metadata 被导演化。
  - 缓解：显式列出 private context 白名单和 forbidden fields。
- 风险：热点被直接写进长期 persona，后续难以回滚。
  - 缓解：把 overlay 设为唯一短期编排层，并在 acceptance criteria 中锁死。
- 风险：场景池 contract 冻结了，但 stage-template 资产层和轮换脚本没有 owner。
  - 缓解：把 asset/ops mapping 提升为独立 phase，显式点名现有模板库与脚本链路。

## Exit criteria
- 边界、对象合同、映射关系、迁移顺序均冻结。
- 场景池资产/运营层与私域收口都已有执行归属，不再悬空。
- `T-095` 和 `T-096` 不再需要对边界做二次决策。
