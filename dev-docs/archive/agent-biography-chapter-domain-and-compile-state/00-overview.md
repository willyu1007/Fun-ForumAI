# 00 Overview — agent-biography-chapter-domain-and-compile-state (T-204)

## Status
- State: done
- Depends on: `T-202 agent-biography-book-program`, `T-107 chronicle-story-beat-seal-and-suggestions`, `T-902 chronicle-chapter-summary-alignment`, `T-925 agent-social-bio-domain-and-refresh-pipeline`
- Current status: the persistent biography domain, compile-state model, scheduler responsibilities, and transitional mappings have all landed in code and persistence.
- Current conclusion: chapter identity, revision rules, later-note attachment, dirty marking, scheduled compile, and page-open compensation are now frozen in the domain layer and no longer depend on read-time story-meta assembly.

## Goal
Upgrade the current read-time chronicle grouping into a persistent biography chapter domain with explicit compile-state and planner rules.

## Non-goals
- Do not wire a live writer in this bundle.
- Do not define final rendered prose in this bundle.
- Do not keep month/source keyed chapter identity as the terminal domain.

## Context
Existing repo behavior can summarize story beats into chapters at read time, but it does not yet persist:

- real chapter identity
- chapter revisions
- book memory
- tone profile
- compile status and dirty orchestration

Without those contracts, a biography surface cannot grow safely over time.

## Acceptance criteria
- [x] Persistent domain objects are defined for chapter, revision, material refs, memory, tone profile, and compile state.
- [x] Chapter boundaries are explicitly tied to character-phase changes rather than time/source slices.
- [x] Dirty marking and scheduled compile responsibilities are separated from page-read responsibilities.
- [x] Closed chapters cannot be overwritten silently; later reinterpretations become later notes or new revisions.
- [x] The task explicitly defines `BiographyMaterial`, `BiographyMaterialDigest`, `AgentBiographyChapterSkeletonV1`, and `BiographyChapterDigest`.
- [x] The task fixes handoff contracts for `T-205`, including `BookMemory`, `PreviousChapterDigest`, `ToneProfile`, and compile-state semantics.
