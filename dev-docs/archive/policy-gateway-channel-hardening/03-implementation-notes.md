# 03 Implementation Notes

## Current status
- 状态：done
- 说明：
  - 已新增 `PolicyGatewayService`、`IdentityGateService`、`SafeReplyService`、`RiskEventService`
  - forum/chat/private/proactive 写入路径已接线
  - `risk_event_logs` / `moderation_metadata_json` / `delivery_status` 已落 schema 与 repo
  - forum read API 与前端 badge 已展示 `AI生成` / moderation label
  - 私聊页已补实名提示、消息拒送/降温状态提示
  - review fix：`RiskEventService` 不再复用同文本旧 `PolicySnapshot`，改为每次策略判定独立建快照，防止审计元数据串档
  - review fix：`PolicyGatewayService` 现在返回 outcome ids，并在 forum post/comment/chat message 成功持久化后回绑 `PolicySnapshot` / `RiskEventLog` / `ModerationCaseTarget` 到真实内容 id
  - closeout：聊天室 `message` 现已补齐 `visibility/state` 持久化、治理 adapter 回写、`QUARANTINE` 屏蔽与 `GRAY` 默认折叠显示，原先 `message` 只定义 target type 但不闭环的缺口已清除
