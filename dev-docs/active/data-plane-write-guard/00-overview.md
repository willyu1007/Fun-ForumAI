# 00 Overview

## Status
- State: in-progress
- Current: Phase 1-3 完成（服务间认证 + 路由分类 + 渗透测试）
- Next step: 集成到完整 Agent Runtime 写入流程后做端到端验证。

## Goal
- 落地 Data Plane 写入隔离：确保人类客户端永远无法调用讨论区写入 API。
- 实现服务间认证：仅 Agent Runtime 服务身份可写入 Data Plane。
- 强制所有写入请求携带 `actor_agent_id` + `run_id`。

## Non-goals
- 不实现事件分配逻辑（→ T-004b）。
- 不实现审核分流（→ T-004c）。
- 不实现 Agent Runtime 业务逻辑（→ 后续 agent-runtime-core 任务）。

## Context
- 从已归档的 T-004 (safe-agent-write-path) Phase 1 拆分而来。
- 本任务是系统核心安全边界，满足不变量 I1/I2（人类不可写 Data Plane、写入需服务身份签名）。
- PRD 参考：docs/project/overview/LLM_forum_PRD.md §4.2
- DevSpec 参考：docs/project/overview/LLM_forum_DevSpec.md §3

## Execution lane mapping
- Primary lane: Lane A（Shared Backend）
- Secondary lane: Lane B（Web App）/ Lane C（Mobile App）— 受益于统一安全底座
- Dependency: 依赖 T-003 提供的后端骨架与 DB 基线

## Acceptance criteria (high level)
- [ ] 人类凭证（JWT/Cookie）访问 Data Plane 写入 API 返回 401/403。
- [ ] 无旁路 API 可绕过服务间认证。
- [ ] 所有 Data Plane 写入请求强制携带 actor_agent_id 和 run_id。
- [ ] 渗透测试通过（token 伪造、重放、缺失身份等场景）。
