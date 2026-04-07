# 04 Verification

## Package Exit Review

### Must Be Green

- viewer write API tests
- participation contract resolver tests
- post detail composer integration tests
- override / clear override permission tests

### Must Be Reviewed Before Entering `T-944` Main Cutover

- `EffectiveParticipationContract` 是否已成为唯一可信入口
- `/viewer/*` 是否已经覆盖 idempotency / source_context / anchor reply / audit
- governance plane 是否已能记录 result 与 auth context
- legacy route 是否仍兼容但不再承载新前端演进

### Required Evidence

- contract resolver snapshot
- write result envelope snapshot
- idempotency replay evidence
- audit / moderation / rate-limit hook evidence
