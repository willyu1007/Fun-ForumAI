# 00 Overview — repo-baseline-governance-and-ui-remediation

## Status
- State: done
- Next step: 无；本包收尾。若后续 UI gate / LLM registry 再次漂移，可单开治理任务承接。
- 收尾备注（2026-03-17）: 与用户确认 PR #10 已合并；main 上已存在本任务相关改动；用户要求推进至收尾，故将本 bundle 闭环并归档。

## Goal
把 repo 当前遗留的 UI governance、LLM registry、project governance 和工作区噪声问题统一收口，同时修复公共主链路新增改动暴露出的功能缺陷。UI governance 在本任务内以 Web frontend 为准，不把 React Native mobile 代码误算进同一套 gate 结果。

## Non-goals
- 不修改数据库 schema
- 不修改 REST wire shape
- 不放宽 `B1-layout-only`
- 不通过 exception/scan exclusion 回避基线错误

## Context
- `T-084` 已完成“中文优先 + 轻富文本 + prompt 结构化输出”的首轮实现，但 review 暴露出三项缺陷：聊天室 `ambient` 消息不保留分段、sanitizer 仍会压扁合法多行总结、Highlights 热帖作者链接回退。
- 项目中曾存在 project governance stale warning：两个幽灵编号错误地指向缺失路径；真实相关任务是已归档的 `T-053 event-contract-routing-baseline`。
- LLM registry validator 当前报 `qwen-social-public-observation-base uses visible line qwen-social-v1 but visibility is hidden`。
- UI gate 基线报告显示 `3086` errors / `82` warnings，主要集中在 Web frontend 的 shared primitives、Layout、ChatRoomPage、PostDetailPage、FeedPage、HighlightsPage 及多个现有 feature 页。

## Closure summary（2026-03-17）
- **已交付**: PR #10 已合并；功能缺陷修复（ambient 分段、sanitizer、Highlights 作者链接、dev-seed 幂等、cue ordinal 并发、PPR 去重、聊天可读性整形、prompt 版本与自愈）；project governance 注册与 stale 清理；LLM registry 校验修复；UI contract 扩展与 uix/uix-shell/uix-primitives 治理；workspace 误复制文件清理。04-verification 已记录 UI gate 全绿、typecheck、targeted tests、live seed、并发 cue、PPR startup、governance sync/lint 等证据。
- **剩余**: 若后续 UI gate 或 LLM registry 再次出现基线漂移，由新任务承接，不扩大本 bundle 范围。

## Cross-links
- 公共主链路子流曾交叉引用：`public-web-chinese-first-content-presentation`（已归档）。
