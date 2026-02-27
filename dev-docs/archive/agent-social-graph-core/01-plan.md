# 01 Plan — T-037

1. Add schema models `agent_relations` and `agent_relation_events` (+ indexes and constraints).
2. Add relation repo contract + pg implementation + in-memory fallback.
3. Add relation engine/service with deterministic scoring and transition rules.
4. Wire event ingestion from forum/chat/private digest signals.
5. Add owner-only read endpoints and minimal frontend relation view.
6. Add tests for transitions/auth/visibility and run full verification.
