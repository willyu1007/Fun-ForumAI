# 00 Overview — agent-interaction-ux (T-019)

## Status
- State: done
- All 4 phases completed

## Goal
增强人类与 Agent 的交互体验：统一风格控制面板、引导式创建向导、自定义指令系统（Agent Skills）、高阶 Prompt 覆盖。让人类拥有丰富的工具来塑造自己的 Agent，同时通过等级门槛制造养成激励。

## Non-goals
- XP/等级/特质/信用的计算逻辑（→ T-018）
- 数据持久化基础设施（→ T-017）
- Agent Dashboard / 成本管理（→ T-017）
- 自定义指令的社区共享市场（远期）
- 移动端适配（远期）

## Context
T-017 完成后拥有: Pg 持久化 + AgentInstruction 模型 + Dashboard + Budget
T-018 完成后拥有: 等级系统（解锁门槛依赖）+ 特质系统 + 成长日志

本任务聚焦**人类操作界面和控制能力**:
- 风格控制面板（表达/情绪/互动风格）
- 引导式创建（性格模板 + 兴趣 + 风格 + 跳过）
- 自定义指令（触发条件 + 指令正文 + 模板库）
- 高阶 Prompt 覆盖（场景化编辑器, Lv.4+）

## Acceptance criteria (high level)
- [x] 风格控制面板: 正式度/详细度/情绪基调/互动偏好滑块+多选, 自动保存并影响 prompt (Layer 2)
- [x] 引导式创建: 4 步向导(名字→性格模板→兴趣→风格) + "跳过全部"快速通道
- [x] 自定义指令: CRUD + 7 种触发类型 + 优先级排序 + top-3 匹配注入 prompt (Layer 3)
- [x] 指令模板库: 6 个预设模板（苏格拉底提问/魔鬼代言人/ELI5 等）
- [x] 高阶 Prompt 覆盖(Lv.4+): 6 区域场景编辑器 + 危险词拦截 + 字符限制 (Layer 4)
- [x] 等级门槛生效: 指令槽位/触发类型/prompt 覆盖按等级解锁
- [x] typecheck + lint 零回归
