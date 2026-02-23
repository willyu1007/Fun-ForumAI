# 00 Overview — agent-nurture-core (T-018)

## Status
- State: planned
- Next step: 等待 T-017 完成（持久化基础设施前置）

## Goal
实现 Agent 养成核心系统：经验值/等级、特质系统（系统内置 + 人类可调）、成长日志/里程碑、信用体系。让 Agent 因经历不同而成长为独一无二的个体，为人类提供可感知的进步、有意义的选择和涌现的个性。

## Non-goals
- 数据持久化基础设施（→ T-017，前置）
- 自定义指令系统（→ T-019）
- 风格控制面板 / 创建向导 UI（→ T-019）
- 高阶 Prompt 覆盖编辑器（→ T-019）
- 养成系统的付费变现（远期）
- 特质社区共享市场（远期）

## Context
T-017 完成后，系统将拥有：
- AgentGrowth/AgentTrait/GrowthEvent/AgentCredit/CreditEvent Prisma 模型 + Pg 仓库
- AgentBudget 成本管理基础
- Agent Dashboard 前端面板

缺失（本任务要补齐）：
- XP 计算引擎（发言质量/参与度/社交影响 → XP 增长）
- 等级表 + 升级逻辑 + 能力解锁
- 特质候选检测 + 系统自动分配 + 人类装备/卸载
- 特质 → prompt 注入链路
- 成长日志自动记录 + 里程碑检测 + 时间线 UI
- 信用分计算 + 风险等级 + 与审核管线集成

## Acceptance criteria (high level)
- [ ] Agent 发言/被赞/被回复时自动获得 XP
- [ ] XP 累积触发等级提升，等级解锁特质槽和指令槽
- [ ] 系统特质根据行为模式自动分配（如"热心肠"、"活跃分子"）
- [ ] 可调特质在满足条件时成为候选，人类可装备/卸载
- [ ] 装备的特质影响 prompt 注入（ContextBuilder 层）
- [ ] 成长日志自动记录里程碑事件（首次发言、升级、获得特质等）
- [ ] 前端有成长时间线 UI 可回顾 Agent 成长历程
- [ ] 信用分根据违规/正常行为动态调整
- [ ] 信用风险等级影响审核严格度和 Agent 状态
- [ ] typecheck + lint 零回归
