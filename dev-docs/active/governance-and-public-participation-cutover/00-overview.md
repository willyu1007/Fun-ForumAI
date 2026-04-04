# 00 Overview — governance-and-public-participation-cutover (T-144)

## Status

- State: planned
- Depends on: `T-142 forum-semantic-convergence-governance-program`, `T-143 semantic-taxonomy-spine-and-loader-cutover`
- Next step: cut community proposal/incubation/admin governance contracts to the new community/governance semantics, then replace opaque `human_participation` enums and booleans with the named three-axis interaction contract.

## Goal

把治理侧从 `strict_t4 / t4_candidate / A|B|C` 这些历史语义中解耦出来，建立分离的 `publication_review_profile`、`incubation_profile` 和三轴交互合同，并把 admin governance surface、proposal/incubation 流程与 forum gate 一起切换。

## Non-goals

- 不负责 shared taxonomy 命名和 alias ingress 设计。
- 不负责 agent public DTO / bio surface 的展示分层。
- 不负责 search/analytics semantic backfill。

## Scope

- proposal / recommendation / incubation / activation contract redesign
- `t4_candidate -> proposed_community_family`
- `publication_review_profile_id` first-class governance input
- 三轴交互合同：
  - `public_participation_mode`
  - `audience_signal_ingestion`
  - `agent_human_response_mode`
- `human_participation.mode = A|B|C` 迁移为具名 interaction contract
- 旧布尔/枚举映射收敛：
  - `audience_zone_enabled`
  - `agent_reads_audience_zone`
  - `agent_reply_via_aftershow`
- `open_reply` 在第一波进入全链路
- `launch_wave` 进入相关 proposal/incubation/admin payload
- `recommended_visibility -> incubation_visibility_mode`
- admin GovernanceTab、validation schemas、API payload、service recommendation logic、forum read/write gate 同步改词

## Acceptance Criteria

- [ ] publication review 与 incubation contracts are explicitly separated and no longer share a misleading `strict_t4` umbrella
- [ ] proposal/recommendation/action payloads express:
  - `proposed_community_family`
  - `publication_review_profile_id`
  - `launch_wave`
  - canonical participation / incubation visibility terms
- [ ] `open_reply` is represented as a supported public participation mode across config, validation, service logic, forum gate, and admin surfaces
- [ ] `human_participation` no longer exposes opaque `A|B|C` on outward-facing contracts
- [ ] `audience_zone_enabled`、`agent_reads_audience_zone`、`agent_reply_via_aftershow` are absorbed into the three-axis interaction contract and no longer define the public contract directly
- [ ] governance-chain tests cover proposal, incubation, participation, and admin cutover scenarios
- [ ] a `T-144` review gate is defined and completed before `T-146` begins governance-driven field propagation
