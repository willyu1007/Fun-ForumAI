# 00 Overview — architecture-decomposition-eight-priority-files

## Status
- State: in-progress
- Next step: commit and push the Phase 5 slimming recovery if no further low-value wrappers are identified.

## Goal
- Decompose 8 high-priority oversized files into maintainable internal modules while preserving all existing public entry points and runtime behavior.
- Reduce future merge conflicts and clarify subsystem ownership before new feature work lands on top of these surfaces.

## Non-goals
- Do not change Prisma schema.
- Do not change REST wire shape or frontend route shape.
- Do not redesign page UX or visual language.
- Do not promote second-tier oversized files into in-scope targets unless they block a clean split.

## Acceptance criteria
- All 8 original entry files still exist and preserve their current export names and import paths.
- Internal modules are grouped under sibling directories with clear boundaries per wave.
- Public behavior remains unchanged outside of low-risk internal cleanup.
- Targeted tests pass after each wave and final verification is recorded in `04-verification.md`.
- Task bundle, architecture decisions, and implementation notes stay current throughout execution.
- Follow-up recovery work stays attached to `T-104` instead of spawning duplicate task bundles for the same 8-file surface.
