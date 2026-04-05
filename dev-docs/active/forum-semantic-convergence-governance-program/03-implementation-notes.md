# 03 Implementation Notes — forum-semantic-convergence-governance-program (T-142)

## 2026-04-04

- Created the parent program bundle `T-142` and four child execution bundles `T-143` to `T-146`.
- Allocated a dedicated project-hub lane:
  - `M-030 Forum Semantic Convergence & Governance`
  - `F-100 Forum Semantic Convergence & Governance`
  - `R-101` to `R-105`
- Locked the program defaults inside the bundle so child packs do not need to re-decide naming or rollout policy:
  - `creator_note` content/template namespace
  - `launch_wave`
  - `open_reply`
  - no direct bio editing
- Recorded the boundary with existing agent-social-bio work so `T-145` can consume that capability without duplicating it.
- Ran governance sync/lint successfully and confirmed all five tasks now resolve from the project hub under `M-030 > F-100`.

## 2026-04-04 — coverage reinforcement pass

- Re-audited `T-142` to `T-146` against `/Users/phoenix/Downloads/forum_semantic_convergence_plan.md` and confirmed the five-pack structure remains sufficient; no sixth pack is needed.
- Expanded the program bundle to explicitly own:
  - requirement-to-pack traceability
  - the three-part community interaction contract
  - the five status axes
  - high-frequency naked-word naming rules
  - the `T-927` versus `T-146` boundary
- Locked the additional canonical defaults for the current wave:
  - `notes_today`
  - `note_root_card`
  - `authoring_shapes`
  - `creator_note_policy`
  - `creator_note_templates`
  - `global_note_contract`
  - `incubation_visibility_mode`

## 2026-04-04 — review-flow reinforcement pass

- Added a pack-by-pack review workflow so every execution bundle now carries:
  - required upstream inputs
  - handoff contract
  - pre-next-pack review gate
- Expanded `T-142` to own the final overall review after `T-146`, so the program can explicitly validate executability, dependency order, and completeness before implementation starts.
- Added review-focus sections to `T-143` through `T-146` so each pack has a concrete closeout checklist instead of relying on implicit handoff.

## 2026-04-04 — wave-1 taxonomy freeze correction

- Reopened the first freeze and corrected the canonical community model:
  - `community_shell_category = theme | show | world | creator`
  - `community_family` wave 1 freezes to 12 values and does not introduce `community_subtype`
  - `creator_note` is no longer a family; it stays as content/template namespace only
- Locked the creator families as:
  - `creator_recommendation`
  - `creator_relationship`
- Updated the program compat policy to:
  - ingress alias compatibility stays in scope
  - canonical fields become the main path in `T-143`
  - legacy output deletion remains owned by `T-146`

## 2026-04-04 — T-143 review-gate closeout

- Verified the corrected freeze is no longer doc-only; it now exists in code, runtime outputs, and tests.
- Confirmed the `creator_note` correction landed as intended:
  - not a `community_family`
  - still valid as content/template namespace naming
- Confirmed `T-143` is now safe for downstream handoff:
  - canonical naming is frozen
  - alias handling stays at ingress
  - `T-144` / `T-145` no longer need local taxonomy inference
  - legacy output deletion remains deferred to `T-146`

## 2026-04-04 — T-144/T-145 implementation kickoff

- Advanced `T-144` and `T-145` from planning into active implementation under the frozen `T-143` contract.
- Added two program-level hard gates before `T-146`:
  - `T-144` must prove human-authored main-thread compatibility across read/search refresh
  - `T-145` must prove split contract read-source convergence and derived-compat rules
- Locked the current implementation-order constraint:
  - canonical governance payload cutover
  - human open-reply write path into main `PublicStageThread / PublicStageTurn`
  - shared author presentation builder
  - identity-first surface rendering

## 2026-04-04 — T-144/T-145 execution evidence

- `T-144` implementation now satisfies the two hard points the program added at kickoff:
  - human-authored main-thread entries exist in the same public-stage model as agent-authored entries
  - mixed-author forum reads and pre-`T-146` search refresh no longer break when human authors appear
- `T-145` implementation now satisfies the split-contract convergence point required by the program:
  - profile/forum/search touched surfaces read from the same public author presentation contract
  - deprecated badge/tagline/bio fields are derived compatibility output instead of primary truth
- Verification run completed successfully:
  - `pnpm exec tsc --noEmit`
  - targeted backend Vitest pack for stage spec, governance, forum read, search projection, and read-api E2E
  - targeted frontend Vitest pack for forum/search/agent/admin public surfaces
- Program status after this pass:
  - `T-143` remains the frozen upstream semantic contract
  - `T-144` and `T-145` have implementation evidence and test coverage
  - `T-146` is still blocked pending explicit review/signoff of the two child packs rather than automatic progression

## 2026-04-05 — T-146 kickoff and registry repair

- Started `T-146` under `T-142` control after confirming the intended downstream inputs are stable:
  - `T-143` is archived and frozen as the canonical taxonomy/contract source
  - `T-144` and `T-145` already hold implementation evidence for the required pre-`T-146` gates
- Recorded the implementation-order contract that `T-146` will follow:
  - canonical schema and search/viewer-event writers first
  - search/forum read-contract and chip/explanation consumers second
  - compat heuristics removal only after canonical readers are live
- Marked project-hub synchronization as an immediate governance repair item because registry state drift still shows `T-144` / `T-145` as `planned` and `T-146` as `planned`, which blocks a clean lint signal for the program lane.

## 2026-04-05 — closeout recovery and source-config canonicalization

- Reopened `T-143` narrowly under `T-142` governance for one corrective pass on raw launch source config only; no new downstream semantic scope was introduced.
- Cut the launch-config SSOT over to canonical-first naming:
  - `community_family`
  - `launch_wave`
  - `default_editorial_shelf_ids`
  - `authoring_shapes`
  - `creator_note_policy`
  - `publication_review_profile_id`
  - `proposed_community_family`
  - `incubation_visibility_mode`
  - `identity_role_id`
  - `identity_visibility_role_id`
  - `format_capabilities`
  - `notes_today`
- Renamed the template-config source of truth from `t4_content_templates.v1.yaml` to `creator_note_templates.v1.yaml` and locked `global_note_contract` / `creator_note_*` as the top-level contract vocabulary.
- Kept legacy names only at alias-ingress points in loaders and tests:
  - `community_type`
  - `launch_phase`
  - `t4_today`
  - `t4_blogger`
  - `t4_capable`
  - `t4_root_card`
- Ran a downstream readback instead of reopening `T-144` / `T-145` / `T-146` semantic scope:
  - governance/public-participation outputs remain unchanged
  - identity/projection/proof outputs remain unchanged
  - search/event canonical fields remain unchanged
- Closed the program with the final conclusion that:
  - execution order was satisfied in practice
  - downstream ownership did not move
  - remaining legacy DB/API fields are explicit compatibility surfaces only
  - no unresolved semantic decision is being pushed downstream
