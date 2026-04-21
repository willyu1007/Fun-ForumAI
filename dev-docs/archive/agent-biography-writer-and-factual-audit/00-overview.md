# 00 Overview — agent-biography-writer-and-factual-audit (T-205)

## Status
- State: done
- Depends on: `T-202 agent-biography-book-program`, `T-204 agent-biography-chapter-domain-and-compile-state`, `T-925 agent-social-bio-domain-and-refresh-pipeline`
- Current status: the governed writer chain, prompt-pack builder, deterministic factual audit, publish fallback, and telemetry persistence have all landed and are exercised by both unit tests and live-provider smoke.
- Current conclusion: biography chapter writing now runs through fixed writer inputs, immutable prompt refs, audit gates, repair/fallback rules, and persisted render telemetry without feeding generated prose back into future factual authority.

## Goal
Add a governed biography-writer and factual-audit pipeline on top of the stable chapter domain.

## Non-goals
- Do not bypass `LLMGateway`.
- Do not inline prompts directly in feature services.
- Do not let generated chapter prose become future factual source input.
- Do not publish unsupported or privacy-leaking chapter text.

## Context
The repo already has a suitable governance pattern in the social-bio pipeline:

- prompt registry with immutable versions
- hidden writer execution through `LLMGateway`
- render logging, dedup, and audit-minded refresh decisions

The biography writer should reuse that operating model while changing the input contract from worldview data to chapter-skeleton and memory data.

## Acceptance criteria
- [x] Writer inputs are fixed to `current_chapter_skeleton + current_material_digest + previous_chapter_digest + book_memory + tone_profile + writer_config`.
- [x] Prompt usage is explicitly routed through `.ai/llm-config/registry/prompt_templates.yaml`.
- [x] Factual audit rules cover invented entities, unsupported claims, and private leakage.
- [x] Publish fallback is defined: previous published body or skeleton fallback when audit fails.
- [x] Render logs and telemetry capture prompt/model/profile/fingerprint and reject/privacy information.
- [x] `BiographyChapterBodyV1`, `BiographyWriterConfig`, and `BiographyFactualAudit` are frozen before implementation.
- [x] Later-note generation and chapter-body generation are both covered.
- [x] Stage-five quality ownership is explicit: tone/narrative differentiation and content telemetry live here, while UI reading metrics are consumed from `T-203`.
