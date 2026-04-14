# 01 Plan — T-201

## Phases
1. Alignment lock
2. Registry migration
3. Hidden director and vision convergence
4. Media generation failover
5. Doubao/Kimi canonical voice-line migration
6. Typed provider extensions (gated)

## Detailed steps
1. Review the roadmap with the user and close the open questions:
   - whether typed provider extensions are in scope now
   - whether `kimi-k2.5` is active immediately or deferred behind typed extensions
   - any exact upstream model IDs still needing vendor confirmation
2. Update LLM registry SSOT:
   - `model_profiles.yaml`
   - `credential_pools.yaml`
   - `model_capabilities.yaml`
   - `model_pricing.yaml`
   - `provider_admission.yaml`
   - keep Doubao represented through profile candidates/admission only, without adding a new `voice_line_id`
3. Regenerate and validate routing artifacts and registry contracts.
4. Update hidden director and vision-summary profiles to the agreed primary/fallback models.
5. Introduce a composite media generation gateway with Ark primary and DashScope fallback.
6. Update media generation configuration/docs to express primary/fallback generation.
7. Replace the temporary Doubao carrier line with a real `doubao-deep-v1` canonical line, restore `kimi-deep-v1` model semantics, and add a one-off live-data backfill CLI plus search reconcile path.
8. If typed provider extensions are later approved, extend the LLM runtime with typed provider-extension fields and adapter serialization.
9. Run targeted verification suites and capture outcomes in `04-verification.md`.

## Risks & mitigations
- Risk: product names do not equal upstream API model IDs.
  - Mitigation: keep a final confirmation step before registry edits and treat unresolved IDs as blockers.
- Risk: vision-summary output drift after moving off prior visual models.
  - Mitigation: keep schema-focused semantic tests and stage fallback ordering.
- Risk: media generation failover complicates observability and job lineage.
  - Mitigation: centralize provider selection in one composite gateway and test metadata writes.
- Risk: provider-specific request controls leak into untyped raw JSON.
  - Mitigation: gate typed provider extensions as a distinct phase with explicit schema.
- Risk: adding a Doubao provider slice expands into a new voice-line family by inertia.
  - Mitigation: treat Doubao as a model/provider choice inside existing lines unless a separate product/persona requirement is approved later.
- Risk: a visible voice line restored as pure `shadow` in `provider_admission` fails registry validation and leaves no admitted candidate surface.
  - Mitigation: keep Kimi semantically restored but out of active persona/challenger routing, instead of forcing an all-shadow visible pool.
