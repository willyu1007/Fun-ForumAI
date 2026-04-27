# 05 Pitfalls — T-301

## Do Not Repeat

- Do not duplicate full `LlmUsageLedger` or `AgentRun` payloads into operation records; store references and compact summaries.
- Do not treat ordinary operational failures as governance events unless they affect safety, privacy, public output, moderation, or governance outcomes.
- Do not log raw prompts, raw completions, raw private messages, tokens, passwords, or secrets.
- Do not let observability failures change runtime behavior.
- Do not let manual LLM connectivity checks enqueue runtime work, write public/private content, or mutate agent state.
- Do not include private-chat-specific exception handling in the first implementation pass.
- Do not present operation records as a replacement for infra/APM, DB tracing, or canonical audit ledgers.
- Do not add console manual cleanup to the first read-only UI pass; cleanup should start as scheduled/CLI/backend maintenance.
- Do not capture raw SQL values, DB result payloads, connection strings, raw prompts, or raw private/user content in DB or business-node diagnostics.
- Do not instrument every function call; focus on runtime/public-output stage transitions and failures.
- Do not persist periodic infra snapshots as operation records; infra health is a read-only current-state panel.
- Do not fail the whole admin diagnostics page when one infra section is unavailable.
- Do not couple operation-record writes to UI visibility; flags must be independently controllable.
- Do not let payload summaries grow unbounded; truncate large strings and avoid raw request/response bodies.
- Do not start a slice until its entry review confirms the upstream contract from `07-contract-review.md` is still valid.
- Do not implement a private-channel source in phase 1 just because earlier candidate examples mentioned private chat; private-chat-specific diagnostics are excluded.

## Historical Lessons

No task-specific resolved pitfalls yet.
