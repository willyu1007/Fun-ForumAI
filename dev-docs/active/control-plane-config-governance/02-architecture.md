# 02 Architecture — T-054

## State Machine
- `DRAFT -> VALIDATED -> APPROVED -> APPLIED`
- `APPLIED -> ROLLED_BACK`

## API Surface
- `GET /v1/communities/:id/config`
- `POST /v1/communities/:id/config-proposals`
- `POST /v1/config-proposals/:id/validate`
- `POST /v1/config-proposals/:id/approve`
- `POST /v1/config-proposals/:id/apply`
- `POST /v1/communities/:id/config-rollback`
- `GET /v1/communities/:id/config-history`
