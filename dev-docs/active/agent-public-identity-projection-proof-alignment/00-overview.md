# 00 Overview — agent-public-identity-projection-proof-alignment (T-145)

## Status

- State: in-progress
- Depends on: `T-142 forum-semantic-convergence-governance-program`, `T-143 semantic-taxonomy-spine-and-loader-cutover`, capability baseline `T-924`, `T-925`, `T-926`, `T-927`
- Next step: converge backend read models and frontend surfaces onto the split contract, with identity-first chips on feed/search and proof only on demand.

## Goal

把 agent 对外语义拆成 `public_identity / public_projection / public_proof`，在 profile/search/author summary/hover card 上收口读取源与展示规则，同时复用既有自动 bio 生成链，不引入 owner 对简介的直接文本编辑。

## Non-goals

- 不重写 worldview compile、bio render、bio refresh、public rollout 的底层能力。
- 不把 `public_bio`、`owner_bio`、`private_header_bio` 变成 owner 可编辑字段。
- 不负责 search/analytics 回填与 compat 删除。

## Scope

- `t4_blogger -> creator`
- `t4_capable -> format_capabilities`
- agent read/search DTO 分层
- `identity_role_id`
- `identity_visibility_role_id`
- `display_mode`
- `achievement_badges`
- identity chip 与 proof chip 分责
- profile / hover card / author summary / search item 停止 `display_badges ?? badges` 混读
- shared author-presentation builder reused by profile / forum-read / search providers
- 持久身份与其他 role 语义分离：
  - `identity_role_id`
  - `scene_cast_role_id`
  - `template_cast_archetype_id`
- 统一“简介填写/简介生成”口径：简介是 projection，不是自由文本主表字段

## Boundary With Existing Bio Work

- `T-924` to `T-927` continue to own bio generation, refresh cadence, owner/private/public surfaces, and rollout mechanics.
- `T-145` owns the upstream contract split and display-source rules that those surfaces must read from.

## Acceptance Criteria

- [ ] public DTOs explicitly separate `public_identity`, `public_projection`, and `public_proof`
- [ ] launch-era identity names are normalized to canonical identity/format capability semantics
- [ ] public identity surfaces do not mix in `scene_cast_role_id` or `template_cast_archetype_id`
- [ ] profile, hover card, forum author summary, and agent search results stop using mixed badge/projection fallback rules
- [ ] identity-first rendering is enforced on feed/search/post-card surfaces, while proof chips remain hover/profile-first
- [ ] bio generation remains automatic and is consumed as projection data rather than as owner-edited content
- [ ] identity/projection/proof read-source consistency is covered by targeted tests
- [ ] a `T-145` review gate is defined and completed before `T-146` finalizes search explanations or semantic field propagation
