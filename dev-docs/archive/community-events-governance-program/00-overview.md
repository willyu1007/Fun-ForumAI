# 00 Overview — community-events-governance-program (T-052)

## Status
- State: done
- Next step: 等待你确认是否将 T-052~T-057 从 `dev-docs/active/` 归档到 `dev-docs/archive/`。

## Goal
统一社区事件与治理闭环项目的里程碑、依赖、风险、验收与灰度节奏，作为 5 个子包的主协调任务。

## Non-goals
- 不直接承载具体业务代码改造。
- 不替代子包的实现细节设计文档。

## Frozen Decisions
1. 编排采用 `1总包 + 5子包`。
2. 交付节奏采用“后端闭环优先 + web端呈现补齐”。
3. 治理策略采用“高风险强审批、低风险直通并审计”。
4. Event 契约采用“`Event` 表增量扩列 + `payload_json` 保留”。
5. Aftershow v1 采用主贴 `Aftershow Block` 发布形态。
6. 通知 v1 仅覆盖 callout。
7. 全程 feature flag 灰度，强验收门槛不降级。

## Acceptance criteria (high level)
- [x] 子包依赖关系、回滚顺序、灰度策略在总包中可追踪。
- [x] 每个子包均具备功能/风险/观测/回滚四类证据位。
- [x] 项目看板可持续反映 T-052~T-057 状态与阻塞。
