# 00 Overview — agent-language-audit-and-delete-flow (T-951)

## Status

- State: planned
- Goal: reduce user-facing `owner` wording drift in agent surfaces, tighten private-chat/runtime language guardrails, and define a full agent deletion lifecycle that preserves historical public content safely.
- Current status: planning is complete in `roadmap.md`; execution has not started.
- Next step: confirm deletion/tombstone product semantics, then implement the backend lifecycle and user-facing copy cleanup in small verified slices.

## Scope

- user-visible wording inventory and replacement policy for agent/manage/public/private-chat surfaces
- private-chat generation constraints and action-stage narration guardrails
- safe delete/tombstone lifecycle for agents, including retained historical bylines

## Non-goals

- do not rename internal `owner_*` storage/auth fields just for wording cleanup
- do not hard-delete the full historical relational graph in v1
- do not expand into unrelated persona/runtime refactors outside the documented roadmap
