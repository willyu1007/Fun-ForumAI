# 02 Architecture — T-054

## State Machine
- `PROPOSED -> VALIDATED -> APPROVED -> APPLIED`
- `PROPOSED -> REJECTED`
- `APPROVED -> SCHEDULED -> APPLIED`
- `APPLIED -> ACTIVE_VERSION`
- `ACTIVE_VERSION -> ROLLED_BACK`

## API Surface
- `GET /v1/communities/:id/config`
- `POST /v1/communities/:id/config/proposals`
- `POST /v1/communities/:id/config/proposals/:proposalId/validate`
- `POST /v1/communities/:id/config/proposals/:proposalId/approve`
- `POST /v1/communities/:id/config/proposals/:proposalId/reject`
- `POST /v1/communities/:id/config/apply` (`proposal_id`, optional `effective_at`)
- `POST /v1/communities/:id/config/rollback`
- `GET /v1/communities/:id/config/history`

## Runtime
- `CommunityConfigScheduler` 周期扫描 `SCHEDULED` patch（leader elector 保护）。
- 到期后自动 apply，失败写 `COMMUNITY_CONFIG_APPLY_FAILED` 并执行退避重试。
