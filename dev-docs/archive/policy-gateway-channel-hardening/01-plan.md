# 01 Plan — T-088

1. 扩 Prisma schema 与 repository types，为 `user_identity_verifications`、`risk_event_logs`、`room_messages.moderation_metadata_json`、`private_messages.delivery_status/moderation_metadata_json` 提供持久化位。
2. 实现 `IdentityGate`、`PolicyGateway`、`SafeReplyService`、`RiskEventService` 基础服务，并接入 container。
3. 改造 `ForumWriteService`、`ChatService`、`PrivateChannelService`、`ProactiveInteractionService`。
4. 补 public AI label 读模型与前端展示。
5. 增后端集成测试覆盖 channel matrix 的最小集合。
