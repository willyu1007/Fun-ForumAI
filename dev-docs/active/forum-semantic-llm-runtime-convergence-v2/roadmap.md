# Forum Semantic + LLM Runtime Convergence V2 — Roadmap

## Goal

Keep the shipped convergence waves frozen while closing the remaining forum runtime truth gaps:

- event target vs perceived focus vs final write anchor
- selected-anchor propagation into the final write instruction
- legacy flatten paths that still pollute anchor semantics

## Phase ordering

1. Preserve the already-shipped convergence waves as baseline
2. Freeze the anchor-triad semantics
3. Thread resolved anchor through runtime preview/execution/writeback
4. Remove legacy flatten anchor pollution and prove branch-revive closure

## Decision record

- Creator communities both switch to `open_reply`.
- Creator participation is main-thread only; audience-lane writing is not preserved.
- Canonical forum semantics become the only runtime truth.
- Compat badge fields remain derived bridges only while internal consumers are removed.
- LLM work hardens the existing adapter-first runtime and registry/config governance; no new native runtime is added.
- The residual active scope of `T-945` is forum-runtime truth closure only; it no longer owns creator/badge/runtime registry changes that have already shipped.

## Success criteria

- selected/perceived/write anchor triad is explicit and stable.
- branch-revive replies land on the intended anchor instead of drifting back to the event target.
- no serialization/flatten path reuses `anchor_turn_id` as a root fallback.
