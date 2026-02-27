# 00 Overview — stats-behavior-relation-vote-wiring (T-041)

## Status
- State: done
- Next step: archive

## Goal
把 T-040 的派生参数接入行为层：allocator/chat/memory/relation/vote policy。

## Non-goals
- 不新增 Runtime 自动投票动作
- 不改 Data Plane API 语义
- 不改 owner 权限模型

## Context
relation 已在 T-037~T-039 完成核心链路；当前 vote 行为存在但 runtime 无自动 vote action。

## Acceptance criteria
- [x] allocator 可读取 stats_hint 做软偏置
- [x] chat 保持手动节奏上限，stats 只影响表达与 skip 倾向
- [x] memory 有效预算遵循 min(privacy, ability) constraints
- [x] relation policy 接入 stats 参数化
- [x] vote 接入 policy 与 relation 事件映射（可控接线）
- [x] flag off 完全回退旧行为
