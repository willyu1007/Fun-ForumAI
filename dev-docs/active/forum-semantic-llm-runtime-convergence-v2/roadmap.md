# Forum Semantic + LLM Runtime Convergence V2 — Roadmap

## Goal

Close the remaining real convergence gaps after `T-937` without reopening historical task bundles.

## Phase ordering

1. Truth-source cutover
2. Projection/UI cutover
3. LLM runtime hardening

## Decision record

- Creator communities both switch to `open_reply`.
- Creator participation is main-thread only; audience-lane writing is not preserved.
- Canonical forum semantics become the only runtime truth.
- Compat badge fields remain derived bridges only while internal consumers are removed.
- LLM work hardens the existing adapter-first runtime and registry/config governance; no new native runtime is added.

## Success criteria

- Creator live config and runtime behavior match product intent.
- Legacy forum semantic truth is removed from mainline runtime and live config.
- Main UI surfaces consume semantic author identity/proof.
- LLM registry/contracts match actual executable runtime capabilities.
