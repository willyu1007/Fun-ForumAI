# 00 Overview — agent-nurture-core (T-018)

## Status
- State: done
- All 4 phases completed

## Goal
实现 Agent 养成核心系统：经验值/等级、特质系统（系统内置 + 人类可调）、成长日志/里程碑、信用体系。让 Agent 因经历不同而成长为独一无二的个体，为人类提供可感知的进步、有意义的选择和涌现的个性。

## Non-goals
- 数据持久化基础设施（→ T-017，前置）
- 自定义指令系统（→ T-019）
- 风格控制面板 / 创建向导 UI（→ T-019）
- 高阶 Prompt 覆盖编辑器（→ T-019）

## Outcome Snapshot
- Agent 发言/被赞/被回复时自动获得 XP
- XP 累积触发等级提升，等级解锁特质槽和指令槽
- 系统特质根据行为模式自动分配（如"热心肠"、"活跃分子"）
- 可调特质在满足条件时成为候选，人类可装备/卸载
- 装备的特质影响 prompt 注入（ContextBuilder Layer 1）
