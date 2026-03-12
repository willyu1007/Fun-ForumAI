# 03 Implementation Notes

## Current status
- 状态：governance-package-created
- 说明：已创建母包与四个子包任务束，并在项目治理中新增 `M-010 / F-050 / R-050~R-053 / T-087~T-091`。产品代码从 `T-088` 开始推进。

## Execution log
- 2026-03-12：
  - 创建 `T-087 mainland-launch-safety-master`
  - 创建 `T-088 policy-gateway-channel-hardening`
  - 创建 `T-089 review-case-and-complaint-foundation`
  - 创建 `T-090 private-influence-provenance-and-config-governance`
  - 创建 `T-091 hot-topic-policy-and-user-transparency`
  - 在 `.ai/project/main/registry.yaml` 中新增 `M-010`、`F-050`、`R-050~R-053`
  - 固定四个子包的依赖顺序、默认处置策略和 rollout 规则
  - 完成 Prisma schema 扩展与手写迁移 `20260312123000_t087_mainland_launch_safety_governance`
  - 打通 `PolicyGateway` / `IdentityGate` / `SafeReplyService` / `RiskEventService` / `ReviewService` / `ComplaintAppealService` / `AgentConfigLintService`
  - 将 forum/chat/private/proactive 写入路径全部接入统一策略评估与风控落库
  - 为 public forum read payload 补 `AI生成` 与 effective moderation label
  - 新增 `POST/GET /v1/reports`、`POST/GET /v1/appeals`、admin moderation queue/case/identity review/risk profile 路由
  - 新增举报与申诉状态页 `/safety`、帖子页举报/申诉入口、私聊实名与消息状态提示
  - 补充后端 service/unit/e2e 与前端页面回归测试

## Follow-ups
- 2026-03-12（review-driven fixes）：
  - 移除 `PolicySnapshot` 的跨对象复用，改为每次 moderation outcome 独立落快照，避免相同文本把不同 target/community/agent 的审计证据串到一起。
  - `PATCH /agents/:agentId/config` 与 `AgentService.updateConfig()` 改为基于最新 revision（含 pending）合并，修复高风险配置待审期间继续编辑会丢变更的问题。
  - `ComplaintAppealService` 增加 report/appeal `target_type` allowlist 与目标存在性校验，阻断任意字符串污染 case 队列。
  - admin risk profile 的 `effective_disclosure_cap` 改为优先读取 runtime privacy settings；同时补纯函数回归测试覆盖 source priority。
- 当前未完成项集中在 `T-091` 尾项：community/scene/agent kill switch、推荐降权/不推荐链路、更多聊天室/通知面透明文案。
- schema 迁移文件已落 repo，但尚未对任何真实 DB 执行 `migrate deploy`；见 `04-verification.md`。
