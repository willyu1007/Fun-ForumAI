# 01 Plan

## Phases
1. Governance and task bundle setup.
2. Requirement coverage alignment against the approved brief.
3. Shared DTO/API contract freeze.
4. Cross-package verification and closeout.

## Detailed steps
- Register the new feature, requirements, and tasks in the project hub.
- Create the four task bundles with aligned goal/non-goal/boundary wording.
- Compare the active bundles against the approved brief and absorb uncovered scope into the existing package split.
- Lock the shared DTOs, composite response shapes, API routes, V1/V1.5/V2 boundaries, and dependency rules.
- Keep implementation notes and verification synced as the three execution bundles land code.

## Execution order and gates
1. `T-105` freezes cross-package contracts before downstream scope expands again.
2. `T-108` and `T-107` may evolve in parallel once the shared DTO ownership is clear:
   - `T-108` owns `OwnerNowSnapshot` and `OwnerProjectionSnapshot`
   - `T-107` owns `OwnerStoryBeat`, `ChronicleChapter`, `NarrativeAchievementSeal`, and `NurtureSuggestion`
3. `T-106` consumes the aggregate contract after the upstream DTO and payload boundaries are stable enough for UI integration.
4. Final closeout requires a cross-package review from `T-105` to confirm no drift in owner-home aggregate shape, privacy boundary, or phase scope.

## Exit criteria
- `T-105` is not done until each downstream bundle has:
  - a stable owner-facing contract section
  - explicit upstream inputs and downstream consumers
  - explicit package-level non-goals
  - an implementation/verification path that can be executed without reopening feature scope

## Feature execution sequence
1. Freeze shared terms and ownership in `T-105`.
2. Land the read-model contracts in parallel:
   - `T-108` for `now` and `owner_projection`
   - `T-107` for beats, seals, chapters, and suggestions
3. Assemble or confirm the owner-home aggregate around those contracts.
4. Land `T-106` UI integration against the already-frozen aggregate.
5. Run feature-level verification:
   - privacy boundary
   - owner-home IA ordering
   - preview/deep-dive contract consistency
   - degraded-state stability

## Risks & mitigations
- Risk: execution bundles drift on ontology or privacy rules.
  - Mitigation: keep `T-105` as the contract anchor and update its architecture notes whenever a decision changes.
- Risk: the new feature track duplicates older personality/guidance scope.
  - Mitigation: explicitly mark reused foundations and keep new work read-model focused.
- Risk: requirement-alignment work silently expands V1 into a much larger redesign.
  - Mitigation: freeze which uncovered requirements stay in V1, which move to V1.5, and which remain V2/public-side follow-up.
