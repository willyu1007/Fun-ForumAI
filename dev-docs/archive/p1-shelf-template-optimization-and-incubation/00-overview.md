# 00 Overview — p1-shelf-template-optimization-and-incubation (T-139)

## Status

- State: completed
- Depends on: `T-135`, `T-136`, `T-137`, `T-138`, `T-140`, `T-141`
- Next step: 进入 archive；后续 profile 调整通过 runtime config 与 contract writeback 完成，不再保留实验轨双写。

## Goal

为首发后 1–2 周准备一条快速吸收灰测反馈的优化线，避免再次回到大范围重构。

## Non-goals

- 不在本任务中扩成长期增长项目。
- 不先做完整 season leaderboard 或 replay 工具。
- 不再定义首发基础治理状态机。

## Context

首发后最先需要被迭代的通常是 shelf 顺序、T4 模板命中率、visual 策略和治理启发式，而不是新的底层系统。基础治理与 incubation contract 已由 `T-141` 前置承接。

## Acceptance Criteria

- [x] 明确首页 shelf AB 与默认视图优化路径。
- [x] 明确 T4 模板、cover 与 visual 策略的迭代回路。
- [x] 明确 incubation heuristics、policy optimization 与数据回写方式。
