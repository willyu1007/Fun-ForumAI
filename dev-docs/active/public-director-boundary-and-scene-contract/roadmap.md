# Public Director Boundary And Scene Contract — Roadmap

## Goal
- 冻结公域导演层的统一边界与对象合同，让后续实现不再在导演、人格、私聊、热点四类概念之间反复摇摆。
- 同时补齐场景池资产层/轮换运营层与私域收口的归属，避免 contract 冻结后仍出现“没人负责真正收口或运营化”的空档。
- 作为 `F-060 Public Scene Pool & Director Orchestration` 的协调入口，统一三包的依赖顺序、冻结点和非目标，防止后续各包各写一套总体叙事。

## Planning baseline
- Project feature: `F-060 Public Scene Pool & Director Orchestration`
- Requirements
  - `R-060 Public Director Boundary and Scene Contract`
  - `R-061 Scene Selector and Scheduled Post Forum Entry`
  - `R-062 Director Runtime State and Chatroom Unification`
- Task packages
  - `T-094 public-director-boundary-and-scene-contract`
  - `T-095 scene-selector-scheduled-post-forum-entry`
  - `T-096 director-runtime-state-and-chatroom-unification`

## Frozen decisions
- 导演层只服务 `forum` / `chat_room` / `scheduled_post`。
- `private_chat` 不进入导演体系；`proactive_dm` 只保留 trigger-aware opening，owner 回复后立即退回普通私聊。
- `StageSpecV1` 继续作为硬治理对象，节目语法通过 `stage_template_v2.director` 承载。
- 热点、活动和关系推进默认进入 `episode_overlay_v1`，不得直接写入长期 persona。
- 角色侧只接收 `LocalIntent + surface-aware + relation-aware + privacy-aware + memory-scope-aware`，不接收完整 director brief。

## Scope
- `stage_template_v2.director` 字段设计
- stage template 生命周期与资产层升级原则
- `scene_binding_v1`
- `episode_overlay_v1`
- `runtime_scene_state_v1`
- `EpisodeBrief`
- `LocalIntent`
- `scene_metadata`
- public/private boundary matrix
- `private_chat` / `proactive_dm` 收口执行矩阵
- `docs/stage-templates/v1/**`、轮换脚本与原子发布链路的升级规划
- feature flag 与灰度矩阵
- 旧对象到新对象的映射与迁移/回退方案

## Package order
1. `T-094`
   - 冻结 public/private boundary、scene contract、scene-pool asset layer、private/proactive remediation。
2. `T-095`
   - 在 `scheduled_post + forum` 上试点 `SceneSelector -> EpisodeBrief -> LocalIntent -> scene_metadata`。
3. `T-096`
   - 接 runtime scene state、scene-aware casting、chatroom adaptor、success metrics 与实验矩阵。

## Cross-package dependency matrix
- `T-095` 依赖 `T-094` 输出：
  - `stage_template_v2.director`
  - `scene_binding_v1`
  - `episode_overlay_v1`
  - `EpisodeBrief`
  - `LocalIntent`
  - `scene_metadata`
  - public/private boundary rule
- `T-096` 依赖 `T-094` 输出：
  - `runtime_scene_state_v1`
  - chatroom 不得独立重定义 director contract
  - private/proactive 不进入 shared runtime
- `T-096` 同时依赖 `T-095` 输出：
  - public-side `scene_metadata` 与 audit 串联形状
  - `EpisodeBrief -> LocalIntent` 的降维前提
- 反向约束
  - `T-095`、`T-096` 不得反向改写 `T-094` 已冻结的边界。
  - 若后续出现新需求，只能在 `overlay / rollout / adaptor` 层扩张，不能把 private/director 重新揉在一起。

## Deliverables
- 公域/私域边界规范文档
- 统一 scene contract 类型草案
- stage template 资产层升级方案：生命周期、状态机、binding/overlay 注入规则、rotation/rollback 契约
- 旧对象映射表：`StageSpec / stage template / PromptOrchestrator / room program / private channel`
- `private_chat` / `proactive_dm` 负向约束清单与执行收口矩阵
- `F-060` 三包职责/依赖/非目标总览
- implementation handoff 顺序：`T-095` -> `T-096`

## Out of scope
- 产品代码实现
- 运营后台和可视化 UI
- 成就系统、排名系统和 richer archetype library
- chatroom/forum 的具体 schema migration 脚本

## Acceptance criteria
- 后续实现者不需要再决定 `scene-aware` 是否下发给角色。
- 后续实现者不需要再决定私聊是否保留 `layer_showrunner`。
- `StageSpec` 与导演语法的边界清晰，不再混成单一对象。
- 热点进入 overlay、不进入 persona 的原则被显式写入合同。
- `LocalIntent` 成为公域角色侧唯一导演输入对象。
- stage template / binding / overlay / lifecycle / rotation / rollback 的归属清晰，后续不需要再新开“场景池资产层补洞”任务才能继续。
- `private_chat`、`proactive_dm` 的真实收口动作有明确 owner 和 acceptance criteria，而不只是原则描述。
- `F-060` 三包之间不存在新的未归属缺口；后续实现者可以直接按包推进，而不需要再补一个“总包”。

## Metrics And Rollout
- Metrics
  - unresolved boundary decisions = `0`
  - private/director context leakage exceptions = `0`
  - public actor prompt contract variants = `1`
  - unowned scene-pool asset/ops decisions = `0`
- Rollout
  - 先冻结合同与资产/私域归属
  - `T-095` 试点 `scheduled_post + forum`
  - `T-096` 再让 chatroom 适配统一协议并接统一观测

## Rollback
- 新合同仅为治理与 task bundle SSOT；未接入实现前不改变现有 runtime 行为。
- 若后续实现遇到阻塞，可暂时回退到现有 `PromptOrchestrator + room program` 路径，但不得推翻本任务冻结的边界定义。
