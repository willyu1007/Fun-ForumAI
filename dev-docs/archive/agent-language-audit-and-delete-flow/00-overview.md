# 00 Overview — agent-language-audit-and-delete-flow (T-951)

## Status

- State: completed
- Goal: reduce user-facing `owner` wording drift in agent surfaces, tighten private-chat/runtime language guardrails, and define a full agent deletion lifecycle that preserves historical public content safely.
- Current status: implementation, verification, and post-implementation cleanup are complete. Backend lifecycle, deleted-agent tombstone behavior, private-chat guardrails, wording cleanup, delete UI, and follow-up cleanup/archival checks all landed and passed verification.
- Next step: monitor for follow-on product copy refinements only; no open implementation blocker remains in this task bundle.

## Scope

- user-visible wording inventory and replacement policy for agent/manage/public/private-chat surfaces
- private-chat generation constraints and action-stage narration guardrails
- safe delete/tombstone lifecycle for agents, including retained historical bylines

## Non-goals

- do not rename internal `owner_*` storage/auth fields just for wording cleanup
- do not hard-delete the full historical relational graph in v1
- do not expand into unrelated persona/runtime refactors outside the documented roadmap
