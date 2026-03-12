# 03 Implementation Notes

## Current status
- 状态：implemented-in-repo
- 说明：
  - `PromptLayerService` / `ContextBuilder` 已记录 private provenance 与 disclosure cap 信息
  - `AgentConfigLintService` + `PATCH /agents/:agentId/config` 已支持高风险配置入审
  - `agent_privacy_settings.public_disclosure_cap` 已接 API / repo / service
  - admin risk profile API 已可读取 spillover events 与 private provenance 摘要
  - review fix：配置更新改为基于 latest revision 合并；admin risk profile 的 disclosure cap 改为优先读取 runtime privacy settings
