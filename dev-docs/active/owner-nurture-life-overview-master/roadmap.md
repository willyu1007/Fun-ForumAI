# Roadmap — owner-nurture-life-overview-master (T-105)

## Goal
- Establish `F-070 Owner Nurture & Life Overview` as the owner-facing narrative track that reuses personality, guidance, and public-scene facts without reopening their foundations.

## Scope
- Freeze ontology, API shape, and package boundaries.
- Register `F-070`, `R-070 ~ R-072`, and `T-105 ~ T-108`.
- Keep implementation aligned across the three execution packages.
- Absorb the requirement-alignment gaps from the owner mindset chronicle restructure brief without creating a new package split.
- Freeze the V1 homepage aggregate, richer story-beat/suggestion/projection contracts, and the V1/V1.5/V2 boundary table.

## Non-goals
- Do not redesign the spectator/public product loop.
- Do not change private/director boundary rules.
- Do not introduce schema migrations unless a real query blocker appears.

## Packages
1. `T-106 owner-life-overview-surface`
2. `T-107 chronicle-story-beat-seal-and-suggestions`
3. `T-108 breathing-cadence-and-projection-signals`

## Requirement-alignment decisions
- Keep the current four-package structure; fold uncovered requirements into `T-105 ~ T-108` rather than adding a fifth package.
- Treat `life-overview` as the owner homepage aggregate, not a thin shell.
- Keep chapter/filter IA and richer suggestion/action contracts in scope for `T-107`, while public-side reuse remains out of scope for V1.

## Rollback
- Revert feature/task registry additions and remove the new owner read-model/API/UI surfaces together.
