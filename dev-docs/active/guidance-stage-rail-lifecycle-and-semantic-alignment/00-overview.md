# 00 Overview

## Status
- State: planned
- Next step: 按 `01-plan.md` 的 implementation slices 进入执行准备，并以 `02-architecture.md` 的合同桥接作为实施基线

## Goal
完善 Guidance 的下一阶段产品包，覆盖三条主线：
- 将首页右 rail 从“onboarding / dual entry 教程容器”收束为“stage-driven continuation rail”；
- 重新定义 Guidance 的全生命周期流程，从 `NEW_VISITOR` 到 `RETAINED` 都以同一套阶段语义承接；
- 完成项目级语义迁移，停止把 Guidance 的核心定义建立在“双主线 / 双入口 / 教程化 onboarding”上。

## Non-goals
- 不把 Guidance 提升为首页主视觉，不改为首页主货架或首屏主模块。
- 不在本包内推进移动端 UI 适配。
- 不在本包内新增另一套平行的 Guidance state machine 或 surface contract。
- 不在本包内把 `track` 清理做成第一刀硬删除；必须按“语义退场 -> 内部去依赖 -> 物理清理”的三阶段完成。

## Context
- 既有 Guidance 体系来自 `T-077` / `T-078` / `T-079` / `T-080`，其中项目级母包将产品定义为“看戏 / 养成”双主线，并在首页通过 dual entry 表达。
- 当前实现中，首页右 rail 仍长期暴露 dual entry 语义，并且 `DUAL_ENTRY` 在 summary 构建时被无条件注入，导致 retained 用户也会持续看到教程式文案。
- 当前讨论已明确新的方向：
  - 完全移除 `dual_entry` 语义；
  - 保留右 rail，不占主视觉；
  - 不再强调“看戏用户 / 养成用户”二分，默认用户同时游玩多条线；
  - 增加更明显的收起/展开入口；
  - 暂不考虑移动端。

## Acceptance criteria (high level)
- [ ] 新任务包明确 Guidance 的新主语义：`stage-driven rail + lifecycle continuation`，并替代旧的 `Guidance & Onboarding V1` 叙事作为后续实现基线。
- [ ] `roadmap.md` 明确 dual entry 退场范围：产品文案、前端 surface、backend module contract、reason code / telemetry / docs 的清理顺序。
- [ ] `roadmap.md` 为四个 stage 定义首页右 rail 的目标信息架构、主次层级和 payoff 逻辑。
- [ ] 任务包明确哪些 contract 要冻结，哪些可以先保留兼容层，以及这些兼容层在第几个 slice 中移除。
- [ ] 任务包明确 Guidance 的全生命周期流程：进入、探索、首个 payoff、持续回流、长期 continuation。
- [ ] 项目治理和 dev-docs 中能清楚表达该任务是对旧 Guidance V1 语义的 follow-up，而不是重开另一条 feature 线。
- [ ] `01-plan.md` 给出可执行 implementation slices，至少覆盖 backend contract、frontend rail、telemetry、schema/type cleanup、verification 五个层面。
- [ ] `02-architecture.md` 给出可落地的合同桥接，能够从 domain event 串到 summary，再串到 right rail takeover、`稍后再看`、回退默认 rail 的完整执行流。
- [ ] 任务包完成覆盖性检查，确认当前 bundle 没有遗留阻塞实施的开放问题。
