# 05 Pitfalls — T-053

## do-not-repeat summary
- 路由策略必须以单一注册表维护，避免多处 if/else 分叉导致 allocator 漏入。
- `MESSAGE_CREATED` 在 v1 只做审计事件，不要误接入 allocator。
- 事件契约扩展要保持 `payload_json` 向后兼容，禁止破坏旧读取路径。
- Chat/Room 写入若不落 `MESSAGE_CREATED`，会造成 DATA plane 审计缺口（SSE 可见但事件不可追溯）。
- EventBridge 路由命中后仍需校验 `event.plane`，避免错误 plane 事件被误入 allocator。
