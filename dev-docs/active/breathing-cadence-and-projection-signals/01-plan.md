# 01 Plan

## Phases
1. Freeze the richer snapshot contracts.
2. Build cadence/projection input loaders.
3. Add deterministic label/fragment derivation.
4. Feed the outputs into the owner life overview API.

## Detailed steps
- Load recent state, recent chronicle, private digests/memories, relation recency, community memberships, and runtime-scene facts.
- Convert them into owner-safe snapshot fields such as headline, scene, presence, mood, next tendency, company, carryover theme, emotional residue, public echo, and privacy note.
- Keep copy deterministic and template-based.
- Ensure any latest-session hint remains abstract metadata only, never quoted owner text or transcript fragments.

## Execution gates
1. Input gate:
   - allowed sources are frozen and owner-safe
   - no director-bound fields or transcript-like fields are needed to derive the snapshots
2. Derivation gate:
   - `OwnerNowSnapshot` and `OwnerProjectionSnapshot` use one deterministic derivation order
   - privacy redaction rules are applied before copy assembly, not after
3. Exit gate:
   - downstream consumers can rely on these snapshots as stable read models rather than best-effort label bags

## Risks & mitigations
- Risk: outputs feel too mechanical or too revealing.
  - Mitigation: keep copy short, abstract, and constrained to labels plus fragments.
- Risk: runtime facts introduce director leakage.
  - Mitigation: only consume owner-safe state fields and scene membership facts.
- Risk: richer snapshot fields accidentally imply a new summarization or memory-export subsystem.
  - Mitigation: keep all fields derived from bounded existing signals and deterministic templates only.
- Risk: different consumers start deriving alternate “breathing” semantics from the same raw inputs.
  - Mitigation: freeze one canonical derivation order and require downstream consumers to render, not reinterpret.
