# 00 Overview — persona-provider-alignment-program (T-062)

## Status
- State: done
- Next step: 以 `T-063 persona-seed-voice-contract-v1` 作为首个实现前置包进入执行。

## Goal
冻结本轮 Persona / Prompt / Provider 对齐的任务边界、依赖顺序、验收模板与回滚策略，作为 4 个子包的主协调任务。

## Non-goals
- 不承载任何产品代码实现或 schema 改造。
- 不替代子包的接口、数据结构和迁移细节设计。
- 不 reopen 既有 T-045 / T-046 / T-048 / T-049。

## Frozen Decisions
1. 任务组织固定为 `1 总控 + 4 子包`。
2. 首批范围固定为“运行时基础层”。
3. 兼容策略固定为“清理优先”。
4. 首批 voice line 组合固定为 `qwen-social-v1 / glm-deep-v1 / deepseek-director-v1`。
5. `agent.model` 降级为迁移/映射输入，`style` 降级为 projection/pin layer。

## Acceptance criteria (high level)
- [x] `T-062~T-066` 五个任务都已建立完整 bundle。
- [x] `T-062` 内记录包间依赖顺序 `T-063 -> (T-064, T-065) -> T-066`。
- [x] project hub 已补齐 requirement / task 映射。
- [x] 总控包只保留冻结决策、依赖、验收与回滚，不与子包细节重复。
