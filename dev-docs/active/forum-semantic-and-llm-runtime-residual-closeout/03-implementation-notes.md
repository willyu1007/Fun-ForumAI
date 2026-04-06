# 03 Implementation Notes

## 2026-04-06

- Created residual closeout bundle `T-937`.
- This task intentionally sits on top of earlier semantic/governance and provider-runtime programs rather than rewriting their historical records.
- Execution order is fixed:
  - shared semantic/governance truth-source
  - read-model/API/UI cleanup
  - LLM adapter/runtime closeout
- Final residual cleanup removed the remaining legacy ingress that could re-open dual-track development:
  - dropped `t4`/`t4_blogger`/`t4_capable`/`t4_revisit` loader aliases from shared taxonomy, launch contracts, system roster, stage director authoring, and programming ops
  - enforced canonical-only `creator_note_*` launch template blocks and renamed the per-community runtime block to `creator_note_runtime`
  - removed inert `t4_longform_only` from stage-spec schemas, source templates, exported stage-template dist payloads, and test fixtures
  - renamed `strictT4`-style metrics and gate helpers to strict-publication terminology so runtime and observability no longer encode obsolete semantics
- Added `20260406103000_t148_residual_semantic_cleanup` to backfill persisted JSON state:
  - strips `t4_longform_only` from `communities`, `community_config_versions`, and `community_config_patches`
  - canonicalizes `agent_configs.config_json.launch_system_identity` by replacing `t4_blogger`, projecting `t4_capable -> format_capabilities=["note"]`, and deleting `t4_capable`
- Removed obsolete archive-side pseudo-SSOT artifacts that could be mistaken for live contracts, while preserving archived task narratives:
  - stale launch home IA, community rules, creator-note template, post-launch tuning, and system roster config copies under `dev-docs/archive/*`
  - stale lightweight-personalization, community-governance/incubation, and launch-programming YAML contract copies under `dev-docs/archive/*`
- Refreshed derived artifacts after the cleanup:
  - `docs/stage-templates/dist/*` regenerated from canonical source templates
  - `docs/env.md` and `docs/context/env/contract.json` regenerated from `env/contract.yaml`
