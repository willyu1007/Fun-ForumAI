# 05 Pitfalls — T-054

## do-not-repeat summary
- 不能从 `DRAFT` 直接 `APPLY` 高风险配置；必须先 `APPROVED`。
- 配置写入后必须补发组件 ACK 事件，否则无法追踪“规则已被谁消费”。
- 兼容旧 `stage-spec patch` 路径时，必须经 proposal 流水，避免绕过审计。
