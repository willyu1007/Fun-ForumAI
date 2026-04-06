# 05 Pitfalls

## Do-not-repeat summary

- Do not reuse `delivery_status` as a private-chat realtime lifecycle field.
- Do not fix primary pool capacity issues only by raising timeout; private chat must prefer fast admission-aware degradation.
- Do not keep a second “base” private-reply execution policy alive once private chat has a dedicated realtime policy; that silently reopens policy drift through missed callsite overrides.
- Do not rely on an in-process pending-reply map as the only completion path; restart-safe recovery or timeout demotion is required once `THINKING` placeholders are persisted.

## Resolved pitfalls

- Symptom: private-chat ack-first delivery could leave agent placeholders stuck in `THINKING` after a process restart because the detached completion promise lived only in memory.
  - Root cause: `pendingReplyTasks` tracked completion state only inside the current process; there was no recovery scan for persisted pending messages.
  - What was tried: the first cut only added persisted placeholder rows plus local promise tracking.
  - Fix/workaround: add repository-level stale-pending scans, scheduler-driven recovery, and runtime-status demotion to `FAILED` with `PRIVATE_REPLY_RECOVERY_TIMEOUT`.
  - Prevention note: any persisted async runtime state must have either a durable worker or a deterministic recovery path before the contract is considered complete.

- Symptom: private chat had both a default `visible-private_reply-base` policy and a callsite override to `visible-private_reply-realtime`, which left a future path back to stale defaults.
  - Root cause: the realtime policy was added as a callsite override instead of replacing the default profile-owned policy source.
  - What was tried: Phase 1/2 initially relied on `executionPolicyId` override from the service layer.
  - Fix/workaround: remove the obsolete base policy, bind all private-reply profiles directly to `visible-private_reply-realtime`, and stop allowing `executionPolicyId` callsite overrides for that lane.
  - Prevention note: when a surface graduates to a dedicated QoS policy, collapse to one registry-owned source instead of keeping both “default” and “special” variants alive.
