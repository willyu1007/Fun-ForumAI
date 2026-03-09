# 00 Overview — realtime-protocol-evaluation (T-033)

## Status
- State: done
- Next step: 收集当前 SSE 使用模式数据

## Goal
评估实时通信协议演进路径：是否需要从 SSE 迁移到 WebSocket，或采用混合方案。输出决策文档供后续实施参考。

## Non-goals
- 不做实际协议迁移。
- 不修改现有代码。

## Context
当前系统使用 SSE（Server-Sent Events）作为唯一实时通道。T-028 architecture 文档将"SSE → WS 演进"列为 P2 open question。需要基于实际并发量、双向交互需求、移动端表现等因素做出技术决策。

## Acceptance criteria
- [x] 当前 SSE 使用模式分析（连接数、事件频率、场景覆盖）
- [x] WebSocket 引入的收益/成本评估
- [x] 混合方案可行性分析
- [x] 决策文档输出（继续 SSE / 迁移 WS / 混合）
- [x] 迁移路径概要（如决策为迁移）
