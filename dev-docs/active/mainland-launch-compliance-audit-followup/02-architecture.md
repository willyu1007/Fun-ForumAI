# 02 Architecture — T-097

- 本任务是审计回归 follow-up，不新增新的治理主链路；只校验并修复 `T-087~T-093` 已声明落地的能力。
- 检查范围覆盖：
  - backend: `PolicyGateway`、`IdentityGate`、`Review/Complaint`、`PromptLayer/Privacy`、`HotTopic`、admin/read/user routes。
  - frontend: help center、Safety Center、AdminPanel、forum/chat/private 页面上的合规提示与入口。
  - runtime: public/chat/private/proactive/config/memory 的关键真实行为。
- 若缺陷需要改动 schema 或配置，必须先证明当前实现和需求存在明确偏差，再做最小修补。
