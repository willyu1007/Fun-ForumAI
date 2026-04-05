# 00 Overview — semantic-taxonomy-spine-and-loader-cutover (T-143)

## Status

- State: done
- Depends on: `T-142 forum-semantic-convergence-governance-program`, archived launch contract work `T-133` to `T-141`
- Next step: archived. The frozen canonical contract set was handed off to `T-144` / `T-145`, received a 2026-04-05 corrective source-config canonicalization pass under `T-142`, and still defers legacy output deletion to `T-146`.

## Goal

建立 shared taxonomy 和 semantic contract spine，并把 config contract、loader、normalizer、runtime helper 切到 canonical 主路径 + legacy 兼容输出，让系统从根上停止把 `t4_*`、中文 shelf label、自由字符串 taxonomy 和混杂 community/content/status 语义作为主路径真值。

## Non-goals

- 不负责 admin governance proposal/incubation UI 的切词与流程更新。
- 不负责 agent profile / hover card / search result 的展示分层。
- 不负责 search index 回填和 analytics schema 扩展。

## Scope

- 新增 shared taxonomy registries：
  - `community_families`
  - `editorial_shelves`
  - `content_formats`
  - `publication_review_profiles`
- 新增 shared contracts：
  - `CommunitySemanticContract`
  - `CommunityInteractionContract`
  - `ContentSemanticProjection`
  - `ScenePhase / StorylineState / CommunityLifecycleState / LaunchWaveId / EditorialShelfId`
- 改 `launch_community_rules`、`creator_note_templates`、`home_ia_and_shelves`、`system_roster` 的 canonical contract
- loader ingress 兼容旧 alias，运行时只输出 canonical
- `launch_phase -> launch_wave`
- `editorial_shelf -> editorial_shelf_id`
- `content_kind`、`format_kind`、`community_family`、`public_participation_mode` 成为 first-class fields
- 社区交互三轴进入 shared layer：
  - `public_participation_mode`
  - `audience_signal_ingestion`
  - `agent_human_response_mode`
- `programming-projection` 明确拆成：
  - `scene_runtime`
  - `narrative`
  - `distribution`
  - `format`
  - `visual`
- `public-scene-selector` 只输出 `editorial_shelf_id`
- `system-roster` 主命名切到 `identity_role_id`、`identity_visibility_role_id`、`format_capabilities`
- 锁定本轮 canonical naming：
  - `notes_today`
  - `note_root_card`
  - `authoring_shapes`
  - `creator_note_policy`
  - `creator_note_templates`
  - `global_note_contract`
- 第一波 taxonomy freeze：
  - `community_shell_category = theme | show | world | creator`
  - `community_family = 12 canonical values`
  - `publication_review_profile_id = standard_publication | creator_strict_publication`
  - `community_subtype` 不在本包第一波范围内

## Acceptance Criteria

- [x] shared taxonomy and contract layer covers:
  - `community_family`
  - `community_shell_category`
  - `publication_review_profile_id`
  - `public_participation_mode`
  - `audience_signal_ingestion`
  - `agent_human_response_mode`
  - `content_kind`
  - `format_kind`
  - `editorial_shelf_id`
  - `launch_wave`
  - `scene_phase / storyline_state / community_lifecycle_state`
- [x] loaders accept old aliases, but runtime/API helpers expose canonical fields as the main path while preserving explicitly scoped legacy compatibility fields
- [x] config/runtime code paths no longer require Chinese shelf labels or `t4_*` names as primary outputs
- [x] touched surfaces no longer introduce naked `visibility / tier / role / mode`; role namespaces are explicit between `identity_role_id`, `scene_cast_role_id`, and `template_cast_archetype_id`
- [x] `launch_phase` is retired or normalized to `launch_wave` on the canonical path
- [x] registry-backed naming is locked for `notes_today`, `note_root_card`, `authoring_shapes`, `creator_note_policy`, `creator_note_templates`, and `global_note_contract`
- [x] canonical-only contract tests and alias-ingress tests are defined for the new spine
- [x] a `T-143` review gate is defined and completed before `T-144` or `T-145` begins execution work

## Review Gate Outcome

- Canonical naming, shell/family/review-profile freeze, and alias-ingress policy are implemented in shared taxonomy + registry code.
- Downstream read surfaces now receive canonical semantic and interaction contracts directly; they no longer need local renaming or category guessing on the main path.
- Non-launch or incubation-only communities no longer break read APIs when they do not carry launch-complete rules; canonical enrichment now degrades to `null` instead of throwing.
- 2026-04-05 corrective pass note:
  - raw launch source config now uses `creator_note_templates`, `notes_today`, `creator`, and `launch_wave` as the canonical SSOT
  - legacy names stay only in loader alias-ingress paths and targeted normalization tests
