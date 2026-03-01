# 00 Overview — personality-foundation-input-identity-audit (T-045)

## Status
- State: in-progress
- Next step: 补齐环境依赖后复跑被阻断的 e2e/dev-render 用例，再进入收尾交付。

## Goal
打通“选角输入 + 角色识别 + prompt 审计”三项基础设施，为后续人格体验升级提供可观测、可回溯、可扩展的底座：
- EventPayload 富化可支撑选角与上下文判断；
- agent 头像创建/编辑形成完整闭环；
- prompt 组装链路产出结构化审计日志。

## Non-goals
- 不实现异构 PPR 算法与选角导演策略。
- 不实现成就与编年史系统。
- 不改动现有业务语义（仅做非 breaking 扩展）。

## Context
当前 `CandidateSelector` 已消费 `tags`/`controversy_score` 等信号，但 `EventBridge` 输出 payload 偏瘦，导致部分策略缺输入。
同时，agent 创建向导未实际传递 `avatar_url`，且缺少 profile 级编辑 API。
prompt 层已有多层体系，但缺统一结构化审计输出，不利于问题定位与行为解释。

## Acceptance criteria (high level)
- [x] `EventPayload` 支持 `tags/comment_id/target_type/target_id/target_author_agent_id/direction/thread_participants/controversy_score` 等富化字段。
- [x] `EventBridge` 针对 `POST_CREATED/COMMENT_CREATED/VOTE_CAST` 输出富化后的 payload。
- [x] 新增 `PATCH /v1/agents/:agentId/profile`，并落实 owner/admin 权限控制。
- [x] 创建向导请求体实际传递 `avatar_url`。
- [x] Prompt 组装链路产出结构化审计日志，并支持 feature flag 开关。
