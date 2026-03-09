# 00 Overview — persona-provider-alignment-program (T-062)

## Status
- State: done
- Next step: `T-070 persona-rollout-shadow-review` 承接 `migrated_visible` 真实样本、blind review、staging shadow logging 与非 `not_run` gate verdict；`T-062` 本身以方案级闭环验收完成。

## Goal
冻结本轮 Persona / Prompt / Provider 对齐的任务边界、依赖顺序、验收模板与回滚策略，作为 4 个子包的主协调任务。

## Non-goals
- 不承载任何产品代码实现或 schema 改造。
- 不替代子包的接口、数据结构和迁移细节设计。
- 不 reopen 既有 T-045 / T-046 / T-048 / T-049。
- 不直接承接 blind review / staging shadow logging / rollout verdict 的执行；这些 follow-up 证据由独立任务承接。

## Frozen Decisions
1. 任务组织固定为 `1 总控 + 4 子包`。
2. 首批范围固定为“运行时基础层”。
3. 兼容策略固定为“清理优先”。
4. 首批 voice line 组合固定为 `qwen-social-v1 / glm-deep-v1 / deepseek-director-v1`。
5. `agent.model` 降级为迁移/映射输入，`style` 降级为 projection/pin layer。

## Acceptance criteria (high level)
- [x] `T-062~T-066` 五个任务都已建立完整 bundle。
- [x] `T-062` 内同时记录原始规划依赖 `T-063 -> (T-064, T-065) -> T-066` 与现实实现承接链 `T-064 -> T-068 -> T-069 -> T-066`。
- [x] `T-063/T-064` 作为已完成 contract 包冻结；`T-065/T-066` 的 closeout 与 follow-up 归位已显式记录。
- [x] project hub 已补齐 `R-030` 与 `T-067~T-070` 映射，并恢复 governance 绿灯。
- [x] `T-070` 已建立完整 follow-up bundle，用于承接 rollout evidence，而非继续把执行证据混入 `T-066`。
- [x] 总控包只保留冻结决策、依赖、验收与回滚，不与子包细节重复。
