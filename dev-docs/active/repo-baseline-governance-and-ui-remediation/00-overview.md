# 00 Overview — repo-baseline-governance-and-ui-remediation

## Status
- State: in-progress
- Next step: 收掉 review 中发现的治理口径问题，明确 UI gate 为 Web frontend 范围，并继续压缩共享壳上的 `uix` 运行时负担。

## Goal
把 repo 当前遗留的 UI governance、LLM registry、project governance 和工作区噪声问题统一收口，同时修复公共主链路新增改动暴露出的功能缺陷。UI governance 在本任务内以 Web frontend 为准，不把 React Native mobile 代码误算进同一套 gate 结果。

## Non-goals
- 不修改数据库 schema
- 不修改 REST wire shape
- 不放宽 `B1-layout-only`
- 不通过 exception/scan exclusion 回避基线错误

## Context
- `T-084` 已完成“中文优先 + 轻富文本 + prompt 结构化输出”的首轮实现，但 review 暴露出三项缺陷：聊天室 `ambient` 消息不保留分段、sanitizer 仍会压扁合法多行总结、Highlights 热帖作者链接回退。
- repo 当前存在 project governance stale warning：`T-083` / `T-085` 指向缺失的 `event-contract-routing-baseline`。
- LLM registry validator 当前报 `qwen-social-public-observation-base uses visible line qwen-social-v1 but visibility is hidden`。
- UI gate 基线报告显示 `3086` errors / `82` warnings，主要集中在 Web frontend 的 shared primitives、Layout、ChatRoomPage、PostDetailPage、FeedPage、HighlightsPage 及多个现有 feature 页。

## Cross-links
- 当前公共链路子流：`dev-docs/active/public-web-chinese-first-content-presentation/`
