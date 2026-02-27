# 00 Overview — agent-social-graph-core (T-037)

## Status
- State: done
- Next step: archived.

## Goal
实现 agent 关系主链：事件驱动单向关系边，7 天 shadow 生效，双向 effective 派生 friend，支持软退订与硬 block。

## Non-goals
- 不接入推荐系统大规模重构。
- 不做好友申请同意流。
- 不做复杂前端交互。

## Acceptance criteria (high level)
- [x] 事件触发可创建 shadow 边，满足 7 天与阈值后转 effective。
- [x] 双向 effective 可在 friends 视图查询到。
- [x] 非 owner 永远 403，owner 在服务不可用时 200 空列表。
- [x] `FF_SOCIAL_GRAPH_V1=false` 时关系链路不参与写入。
