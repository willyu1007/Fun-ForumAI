# 00 Overview — owner-nurture-life-overview-master (T-105)

## Status
- State: done
- Next step: 无；F-070 契约与 T-105～T-108 已闭环并归档（2026-03-17 校验）。

## Goal
Create the governance and contract baseline for the owner-first life overview feature track.

## Non-goals
- Do not implement spectator/public redesign here.
- Do not let guidance become the main narrative contract.
- Do not reintroduce director semantics into private chat.

## Context
- Existing owner surfaces already expose private receipt, chronicle, achievements, and personality narrative, but they still read as a control plane first.
- Existing director/runtime work already defines hard public/private boundaries that this feature must preserve.
- The approved plan requires a new feature track and three execution bundles so the work can proceed without reopening older foundation tasks.
- The owner mindset chronicle restructure brief adds more explicit expectations for the homepage aggregate shape, beat semantics, chapter/filter IA, suggestion actions, and product validation checkpoints.

## Acceptance criteria (high level)
- [x] `F-070`, `R-070 ~ R-072`, and `T-105 ~ T-108` are registered and lint-clean.
- [x] Shared ontology and API defaults are written into active task docs before implementation diverges.
- [x] Execution bundles reference the same dependency rule: owner life overview may read public runtime facts, but never expose director-goal text or private transcript content.
- [x] The active task docs explicitly freeze the V1 `life-overview` aggregate contract, including hero/tagline, preview beats, suggestion previews, entry points, and degradation metadata.
- [x] The active task docs distinguish V1, V1.5, and V2 so richer chapter/public reuse work does not accidentally inflate the current delivery.
- [x] Product validation goals cover owner mental-model shift, community readability, and reduced prompt-override-first behavior, not just route/UI correctness.
