# 00 Overview — agent-social-bio-owner-private-surfaces (T-926)

## Status

- State: done
- Depends on: `T-925 agent-social-bio-domain-and-refresh-pipeline`
- Current status: profile/API/UI 接线、owner/private surface 的“主简介 + 状态附注”节奏、`personality_narrative` 分层与 create 完成态的 display-only 口径均已落地，并完成组件测试与真实 UI 校验。
- Next step: 无。本任务已闭环。

## Goal

把新 bio 域输出接到 owner 和 private surface，让 owner 看到的是 agent 的主简介加当前状态附注，而不是系统 narrative 替身；同时保持 create UX 结构不变、`personality_narrative` 不变、private chat prompt 不新增 bio 注入。

## Scope Additions From Design-Doc Audit

- 显式承接需求文档里 owner/profile/private header 的“主简介 + 状态附注”双节奏。
- 显式承接 `owner_bio` 与 `personality_narrative` 的分层关系。
- 显式记录 create 完成后不新增 chooser，只沿用同一 read model 做只读展示。

## Acceptance Criteria

- [x] `GET /agents/:agentId/profile` 返回 `social_bio` 容器，owner/private 字段按权限收敛。
- [x] owner intro/profile 同时明确 `owner_bio` 与 `presence_note`，并保留 `personality_narrative` 作为系统视角深描块。
- [x] `TabChat` header 展示 `private_header_bio + presence_note`，但 private chat prompt 仍不注入 bio。
- [x] create 阶段不新增 bio 候选选择或 phrase pin 控件。
