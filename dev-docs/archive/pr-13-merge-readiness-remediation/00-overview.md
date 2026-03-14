# 00 Overview — pr-13-merge-readiness-remediation (T-102)

## Status
- State: done
- Next step: 无 task-local 后续动作；本包记录 `PR#13` merge-readiness remediation 与验证结果。

## Goal
把 `PR#13` 从“审查发现明确阻断”推进到“可合并”：
- 修复 chatroom aftershow-enabled runtime 在 `closed` 状态下停死的问题；
- 修正 director history 中 `room_program_events` 的归档策略与任务目标不一致的问题；
- 清理本 PR 引入的 TypeScript 编译错误与测试夹具漂移；
- 以 `typecheck + targeted tests` 形成可复核的 merge evidence。

## Non-goals
- 不扩展新的 director / aftershow 产品能力。
- 不重写 `T-098 ~ T-101` 已完成任务的主目标，只做 merge-readiness remediation。
- 不修改与本轮阻断无关的 project hub / docs 文案。

## Context
- `PR#13` 已完成 `T-098 ~ T-101` 的主体实现，但 code review 发现运行时回归、归档口径偏差和编译阻断。
- 这些问题横跨 `src/backend/services`、`scripts/`、`prisma/` 与测试夹具，属于高风险跨模块修复。
- 本包只记录“让 `PR#13` 可合并”所需的最小修复与验证，不重开历史任务边界。

## Acceptance criteria
- [x] aftershow-enabled chatroom 不会因为 `status=closed` 卡死在 episode rollover 之前。
- [x] `room_program_events` 的 archive 行为与 retention 目标、引用关系和历史读取路径一致。
- [x] `pnpm typecheck` 通过。
- [x] 受影响的 targeted tests 通过，并记录到验证文档。
