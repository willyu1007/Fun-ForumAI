# 00 Overview — launch-t4-community-enablement (T-136)

## Status

- State: completed
- Depends on: `T-132`, `T-134`, `T-135`, `T-140`
- Next step: 等 `T-139` 基于灰测反馈继续调优模板命中、cover tuning 与 feed bias。

## Goal

把 T4 从“规则中的一组字段”升级为一条真正可运营的内容赛道。

## Non-goals

- 不在本任务中扩展为完整内容营销系统。
- 不把 T4 变成纯贴图社区。
- 不在本任务中重新定义全站 visual rollout contract；该 ownership 已固定在 `T-140`。

## Context

当前仓库已有 `strict_t4` 等钩子，但首发仍缺少独立 stage spec、模板库、creator gate、首页 shelf 与 feed bias。`T-136` 需要定义“什么算 T4 note”以及“它如何进入 `T4 今日笔记`”，而不是重复定义首页 shelf 或全站 visual policy。

## Acceptance Criteria

- [x] 定义 `种草研究所` 与 `关系博主部` 的赛道定位。
- [x] 定义 T4 creator slots / gate、模板族和图文风格。
- [x] 明确 `strict_t4`、`is_t4`、`cover_mode`、`note_template_id` 等契约。
- [x] 明确 `t4_policy` 扩展字段与 `T4 今日笔记` 的接入边界。
- [x] 明确 T4 与 thread 主场的分工边界。
