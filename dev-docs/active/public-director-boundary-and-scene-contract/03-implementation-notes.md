# 03 Implementation Notes — T-094

- 2026-03-13 初始化 planning-only task bundle，承接“场景池 + 公域统一导演协议 + 私域边界收口”的治理工作。
- 本包明确不复用旧 task：
  - `T-046` 仅负责跨场景 prompt 编排治理；
  - `T-073 ~ T-075` 仅负责聊天室节目化与 projection/ecology；
  - `T-016` 继续保留为长期 backlog 仓库。
- 本包挂接到新 feature `F-060 Public Scene Pool & Director Orchestration`，并占用 requirement `R-060`。
- 当前没有产品代码改动；后续实现入口依赖 `T-095` 和 `T-096`。
- 2026-03-13 覆盖性评审后，已把两类原先悬空的缺口并回本包：
  - scene-pool 资产层/轮换/运营化归属；
  - `private_chat` / `proactive_dm` 的执行级收口矩阵。
- 2026-03-13 为避免 `F-060` 后续实施时再次出现“总口径漂移”，已把本包同时提升为 feature-level coordination entry：
  - 在 `roadmap.md` 中补齐 `F-060` 的 planning baseline；
  - 固化三包顺序、依赖矩阵与禁止反向改写条款；
  - 明确不新增第四个横向 task bundle。
- 2026-03-13 进入合同细化阶段：
  - 将 task 状态从 `planned` 推进到 `in-progress`；
  - 在 `02-architecture.md` 中补齐字段级 schema 草案：`stage_template_v2`、`scene_binding_v1`、`episode_overlay_v1`、`runtime_scene_state_v1`、`EpisodeBrief`、`LocalIntent`、`scene_metadata`、`PrivateChatContext`、`ProactiveDmOpeningContext`；
  - 显式拆分 `director_surface / actor_surface / private_surface`，解决 `PromptScene` 与真实写入面的混用问题；
  - 冻结 feature flag 命名建议，供 `T-095 / T-096` 后续实现接线。
- 2026-03-13 继续收窄三类高风险合同：
  - `scene_binding_v1` 改为“单挂载点”模型，避免一个 binding 同时表达 forum/chatroom 多挂载；
  - `episode_overlay_v1` 补齐 `topical_context / source_links / safety`，让热点/运营注入既可审计又不直接污染 actor prompt；
  - `LocalIntent` 去掉模糊的 `memory_scope='inherit'`，改为显式 public memory scope，并加入 `opinion_policy / reference_scope / prohibited_reference_types`。
- 2026-03-13 用户确认两项进一步收口决策，并已写入合同：
  - `LocalIntent.reference_scope` 采用 `seed_only / thread_only / room_window / episode_public_context`，而不是抽象二值枚举；
  - `episode_overlay_v1.source_links` 采用“按事实性分层强制”规则，而不是所有 overlay 一刀切必填。
- 2026-03-13 冻结前 review 继续收口三类宽字段：
  - `scene_binding_v1.activation.trigger_conditions` 与 `governance.risk_override` 改为枚举，避免 selector 接入时出现 free-text 语义漂移；
  - `episode_overlay_v1` 显式禁止 `autonomous + external_verified` 组合，并限制 `facts_digest` 不得偷带导演语义；
  - `LocalIntent.target_ref` 改为结构化 union，并按 `delivery_surface` 固定可用形状。

## Open follow-up actions
- `T-095` 需基于本包冻结的 contract 设计 `SceneSelector` 和 `scheduled_post/forum` 接入。
- `T-096` 需基于本包冻结的 private/public boundary 设计 chatroom adaptor 与 runtime state。
