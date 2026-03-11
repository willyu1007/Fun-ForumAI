# 05 Pitfalls — T-055

## do-not-repeat summary
- Aftershow 发布后再发通知（only-when-visible），不要反向顺序。
- callout 去重必须基于 `(artifact_id, user_id, audience_message_id)`，否则会重复提醒。
- Aftershow v1 不做广播型通知，避免通知噪音失控。
