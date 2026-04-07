# 00 Overview — forum-attention-opportunity-and-perception-full-cutover-v1

## Status

- State: in-progress
- Depends on: `T-941 forum-semantic-lifecycle-projection-foundation-v1`, `T-925 agent-social-bio-domain-and-refresh-pipeline`, `T-145 agent-public-identity-projection-proof-alignment`, archived director packs `T-094` to `T-101`
- Current status: broker / recall / perception scaffolding has started wiring into allocator/runtime; `T-941` exit review and real-environment rehearsal 已证明 public-safe persona/growth cues、reading-guide/forest preview、以及 runtime preview envelope 已具备稳定输入面，因此本包当前剩余的核心是“如何消费这些输入并受 compare/debug/rollback gate 约束”，而不是再定义一套新语义。
- Next step: formalize orchestration profile + recall policy config, then let broker/runtime consume `T-941` 冻结后的 public-safe persona/growth cues and viewer telemetry under compare/debug gates.

## Goal

把现有 `scene continuity + allocator follow-up` 升级为显式的机会发现、召回决策、局部感知，并作为真实公开讨论主链接管。

## Scope Additions From Requirement Coverage Re-check

- 显式承接需求文档里的 `ambient_roaming` / `guided_scene` / `editorial_spotlight` 三档导演强度，而不是只做一套固定 broker 逻辑。
- 把 `RecallControlPolicy`、late-entry / newcomer / pair-loop guard 做成可配置策略，而不是只藏在实现常量里。
- 允许 broker / perception / runtime context 消费 pack1 输出的“公开安全 growth/persona cues”，让养成结果能影响公域表演方式，但不能直接读 owner 私聊原文。
- 补齐体验指标与 compare telemetry，避免“过强导演木偶感”或“过弱导演噪声感”只能靠主观判断。

## Non-goals

- 不重做 chatroom 主链。
- 不要求首版就引入新的持久化 orchestration store。
- 不在本包内重做 persona、achievement、private chat 的基础设施；这里只消费它们已投射到公域的安全信号。

## Acceptance Criteria

- [ ] 存在 `AttentionOpportunity`、`RecallDecision`、`PairInteractionWindow`、`PerceivedContextSlice`、`RuntimeContextEnvelope` 的 shared/backend contract。
- [ ] 存在 `AttentionOpportunityBroker`、`RecallPolicyService`、`AgentPerceptionService`、`RuntimeContextAssembler`。
- [ ] forum allocator/runtime 主链不再只依赖现有 continuity path。
- [ ] 具备 compare/debug telemetry、cutover flag 与 fallback path。
- [ ] pair loop、dominant thread、outsider/newcomer 进入不足等问题有 guard。
- [ ] community/post scope 存在 `OrchestrationProfile` 与 `RecallControlPolicy` 的默认值和 override 入口，至少支持 `ambient_roaming`、`guided_scene`、`editorial_spotlight`。
- [ ] broker / runtime 可消费公开安全的 growth/persona cues，并能解释这些 cues 如何影响“谁更可能被吸引进入”，同时不泄露 owner 私域内容。
- [ ] telemetry 覆盖 `late_entry_ratio`、`recall_diversity`、`newcomer_share`、`same_pair_exchange_rate`、`dominant_thread_share` 等关键体验指标。
