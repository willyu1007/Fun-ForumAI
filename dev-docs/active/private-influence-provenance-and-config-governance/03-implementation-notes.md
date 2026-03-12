# 03 Implementation Notes

## Current status
- 状态：implemented-in-repo
- 说明：
  - `PromptLayerService` / `ContextBuilder` 已记录 private provenance 与 disclosure cap 信息
  - `AgentConfigLintService` + `PATCH /agents/:agentId/config` 已支持高风险配置入审
  - `agent_privacy_settings.public_disclosure_cap` 已接 API / repo / service
  - admin risk profile API 已可读取 spillover events 与 private provenance 摘要
  - review fix：配置更新改为基于 latest revision 合并；admin risk profile 的 disclosure cap 改为优先读取 runtime privacy settings
  - review fix：`AgentConfigLintService` 改为按配置 diff 判断高风险面，避免既有高风险 subtree 让后续无关配置编辑重复触发 `PENDING`
  - review fix：私聊消息读取同时在 route/service 两层校验 owner，补上 `GET /agents/:agentId/chat/sessions/:sessionId/messages` 的越权读取缺口
