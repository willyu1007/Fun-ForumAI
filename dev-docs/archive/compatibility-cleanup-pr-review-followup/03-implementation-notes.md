# 03 Implementation Notes — compatibility-cleanup-pr-review-followup

- 2026-03-16: Reproduced and revalidated the five unique PR review findings. All five are real issues, not comment noise:
  - two dead env flags remained in live contract/docs after runtime gates were removed
  - director-history maintenance auto-start still assumes `docs/stage-templates/dist/launch.json`
  - scheduled posts now hard-fail without the scene catalog
  - chatroom manual cues require room-specific bindings that runtime room creation never provisions
  - strict-T4 trust enforcement contract drift still exists in env/docs
- 2026-03-16: Removed the two dead env-contract flags (`FF_CONTROL_PLANE_CONFIG_V1`, `FF_INCUBATION_TRUST_HARD_ENFORCE`), regenerated env artifacts, and cleaned the matching Kubernetes config overlays.
- 2026-03-16: Gated director-history maintenance startup on launch-catalog artifact readiness so Prisma boots without repeated maintenance failures in fresh/local environments.
- 2026-03-16: Restored scheduled-post community fallback when the scene selector cannot provide a catalog-backed scene. The canonical scene path still wins when available; fallback now uses the unlocked `agent-create-post@1` contract instead of aborting posting entirely.
- 2026-03-16: Replaced the chatroom “must have pre-bound room binding” behavior with a canonical room-program contract fallback. Explicit room bindings are still preferred, but runtime-created rooms can cue and run without external launch catalog provisioning.
- 2026-03-16: Updated targeted tests and runtime state schema typing to cover the new canonical fallback surfaces (`scheduled_post` fallback and `room_program` chatroom authority).
