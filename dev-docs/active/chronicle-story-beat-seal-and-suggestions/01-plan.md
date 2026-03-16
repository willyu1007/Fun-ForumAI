# 01 Plan

## Phases
1. Freeze the richer story-beat/chapter/suggestion contracts.
2. Define shared backend/frontend DTOs and story-meta helpers.
3. Build the owner chronicle adapter and seal linker.
4. Add rule-based nurture suggestions and route exposure.

## Detailed steps
- Add `ChronicleStoryMetaV1` and related owner DTOs to shared/backend/frontend types.
- Keep `ChronicleType` coarse and move narrative precision into `metaJson.story_kind` and related soft-taxonomy fields.
- Build read-time fallback mapping for chronicle entries with missing story meta.
- Link achievements to beats using evidence overlap, signal lineage, time-window proximity, and scope constraints.
- Generate deterministic suggestion lanes from recent beats, projection residue, relation recency, and state cues.
- Freeze suggestion object semantics for `priority`, `why_now`, `expected_progress`, `primary_action`, and `secondary_action`.
- Freeze chronicle deep-dive support for chapter, actor, scene, and source-dimension filters, even if the first UI is still lightweight.

## Execution gates
1. Contract gate:
   - preview and deep-dive consumers share the same canonical beat/suggestion types
   - source-dimension labels and story-kind soft taxonomy are frozen before ranking logic expands
2. Read-model gate:
   - legacy fallback, seal linking, and suggestion ranking all run deterministically from bounded inputs
3. Exit gate:
   - homepage preview and chronicle deep dive can both consume the same outputs without UI-local reinterpretation or enum/schema changes

## Risks & mitigations
- Risk: legacy data quality is too uneven for clean beat generation.
  - Mitigation: keep fallback templates simple and deterministic.
- Risk: suggestion output feels like a task list.
  - Mitigation: keep the copy framed as experience progression, not reward farming.
- Risk: chapter/filter scope quietly grows into a separate public chronicle redesign.
  - Mitigation: keep the IA contract owner-side only in V1 and defer public reuse to later phases.
- Risk: ranking/linking logic forks between homepage preview and deep-dive feed.
  - Mitigation: define one canonical transformation pipeline and let consumers select subsets, not recompute semantics.
