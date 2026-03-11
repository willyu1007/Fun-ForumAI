# 02 Architecture — T-053

## Contract
- `EventEnvelopeV1`
- `EventPlane = DATA | CONTROL | RUNTIME`

## Hard Rules
1. 仅 `POST_CREATED/COMMENT_CREATED/VOTE_CAST/RoomTick` 可入 allocator。
2. Control/Aftershow/Notification/微动作事件一律不入 allocator。
3. `MESSAGE_CREATED` v1 仅审计事件化。
