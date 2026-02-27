# 00 Overview — agent-social-graph-consistency-hardening (T-039)

## Status
- State: done
- Next step: archived.

## Goal
强化并发与重放一致性，增加运维处置闭环并完成归档。

## Acceptance criteria
- [x] event replay idempotency by unique `idempotency_key`.
- [x] optimistic relation updates via version expectation.
- [x] hourly leader-only reconcile scheduler landed.
- [x] blocked state only released through admin path.
