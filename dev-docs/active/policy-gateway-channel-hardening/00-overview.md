# 00 Overview — policy-gateway-channel-hardening (T-088)

## Status
- State: in-progress
- Next step: 进入 rollout / shadow 配置与真实环境迁移阶段；repo 侧 schema、service、API、UI 标签和测试已落地。

## Goal
让 `forum/chat/private/proactive` 统一进入策略评估与风险事件记录，不再存在裸写口，同时保证首版默认策略是“红线阻断，其余高风险优先 rewrite”。

## Non-goals
- 不在本包中实现完整 case/review/complaint UI。
- 不接外部实名供应商。
- 不一次性完成热点策略和 provenance 压帽。

## Acceptance criteria (high level)
- [x] `ForumWriteService` 改走 `PolicyGateway`，public 缺配置时 fail-closed。
- [x] `ChatService.sendMessage()` 接策略闸门并落 `moderation_metadata_json`。
- [x] `PrivateChannelService` 对 inbound/outbound 都做策略评估，并对 outbound 支持 rewrite/refuse。
- [x] `ProactiveInteractionService` 创建 session/message 前先做 `IdentityGate` 与策略评估。
- [x] `risk_event_logs` 可查询每次 block/rewrite/refuse。
- [x] public payload 可透出 `AI生成` / moderation label 元数据。
