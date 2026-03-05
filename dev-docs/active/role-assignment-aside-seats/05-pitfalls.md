# 05 Pitfalls — T-056

## do-not-repeat summary
- Membership 与 RoleAssignment 语义不能混淆：Membership 负责“能否参与”，RoleAssignment 负责“以何席位参与”。
- allocator 过滤 aside seats 时，必须限定到当前 `post_id`，否则会污染跨贴候选池。
- `EXPIRED` 与 `REVOKED` 需要区分事件语义，避免后续审计混乱。
