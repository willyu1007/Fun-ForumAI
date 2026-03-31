# 00 Overview — launch-programming-ops-and-rollout (T-137)

## Status

- State: done
- Depends on: `T-132`, `T-133`, `T-134`, `T-135`, `T-136`, `T-140`, `T-141`
- Next step: 由 `T-138`、`T-139` 继续消费 Programming read model，补个性化分发和首发后调优。

## Goal

让首发世界拥有最小可用的节目运营能力，包括排班、roster 调度、社区席位、视觉比例和高光/aftershow 触发观察。

## Non-goals

- 不在本任务中做成熟的节目制作台。
- 不依赖人工临场手动改数据维持首发供给。
- 不在本任务中重定义视觉 rollout 或社区治理状态机。

## Context

现有 aftershow、role assignment、scene selector、visual rollout 和 config governance 已具备底座，但仍缺少首发运营视角下的统一面板和日常运行节奏。`T-137` 需要把节目层 contract 固定下来，并显式引用 `T-140` 的视觉 contract 与 `T-141` 的治理状态。

## Acceptance Criteria

- [x] 冻结日/周节目排班模板与社区供给基线。
- [x] 明确 roster 分配、resident/guest/role assignment 的运营面需求。
- [x] 明确 visual ratio、highlight candidate、aftershow trigger 和健康度指标。
- [x] 明确灰度、回滚与发布前演练要求。
- [x] 明确节目层与治理引用层的 ownership split。
