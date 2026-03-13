# 02 Architecture

## Service contract
- `IdentityGate.assertVerified(userId, capability)`：能力级准入校验，失败抛 `ForbiddenError`。
- `PolicyGateway.evaluate(input)`：返回 channel-aware decision、moderation result、action reason、policy snapshot stub。
- `SafeReplyService.rewriteOrRefuse(input)`：对高风险非红线文本做降温改写；改写失败则返回拒绝模板。
- `RiskEventService.record(input)`：记录 block/rewrite/refuse/shadow 事件。

## Integration points
- `ForumWriteService.createPost/createComment`
- `ChatService.sendMessage`
- `PrivateChannelService.createSession/sendMessage`
- `ProactiveInteractionService.onVoteReceived/onOpinionChallenged`

## Rollout
- enforcement flag 对 chat/private/proactive 先可 shadow。
- `IdentityGate` 不走 shadow，直接 hard gate。
