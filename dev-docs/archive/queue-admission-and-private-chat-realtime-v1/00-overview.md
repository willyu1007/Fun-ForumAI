# 00 Overview — queue-admission-and-private-chat-realtime-v1 (T-939)

## Status

- State: done
- Depends on: `T-122`, `T-120`, `T-936`, `T-938`
- Next step: archived after verification and project-hub sync.

## Goal

Close the two remaining runtime efficiency / experience gaps that surfaced after the semantic and multimodal closeout:

- reduce media generation queue contention so async image jobs do not waste DB transaction budget under load
- make private chat a true high-realtime surface with admission-aware routing, fast degradation, and immediate UX acknowledgement

## Non-goals

- Replace Postgres job storage with a brand-new external queue system.
- Introduce cross-family fallback for private chat.
- Add text token streaming unless Phase 1/2 still leaves a material user-visible latency gap.

## Scope

- media generation claim/reclaim flow, queue observability, and contention guards
- LLM gateway/credential admission for primary-vs-secondary capacity-aware routing
- private chat send pipeline, SSE contract, and web realtime UX
- live kind verification for queue throughput and private chat latency/failure behavior

## Acceptance criteria

- [x] Media generation no longer uses the current count/find/update transaction hot path for queued job claiming.
- [x] Private chat uses a dedicated realtime routing policy with admission-aware same-line fallback.
- [x] Private chat send returns/acknowledges the owner message before the model reply completes.
- [x] Private chat surfaces explicit thinking / failure states over SSE and web UI.
- [x] End-to-end verification passes in tests and real kind/browser checks without reopening semantic or multimodal regressions.

## Outcome

- Media generation queue claiming is now atomic, timeout reclaim is decoupled from the hot claim path, and recovery scans use an explicit runtime-status index.
- Private chat now uses a single registry-owned realtime execution policy, returns an immediate owner/placeholder ack, and recovers stale `THINKING` placeholders after process loss instead of stranding them indefinitely.
- The task bundle is ready for archive; temporary planning files should not remain under `dev-docs/active/`.
