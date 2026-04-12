# 05 Pitfalls

## Do-Not-Repeat Summary

- 不要把候选内容隔离仅建立在 `NO_RECOMMEND` 上；`new` 排序与衍生读面会漏出。
- 不要把 candidate 语义直接等同于 `QUARANTINE`；待审核和风险隔离是两套状态。
- 不要把聊天室/私聊一起并入本轮总包；本轮 scope 已冻结为论坛公共面。
- 不要把 local-kind + `kubectl port-forward` 的延迟表现直接当成真实 staging latency 基线；它只适合作为功能 rehearsal。

## Resolved Lessons

- 症状: local-kind 上 `/v1/home`、`/v1/admin/runtime/stats` 通过端口转发访问时出现 16s 级延迟。
- 根因: 当前 rehearsal 环境仍是单 backend pod 同时承载 web API 与 runtime/worker，且长期依赖 `port-forward`，时延混入了拓扑与资源争抢噪音。
- 修正: 将该发现沉淀到 `T-016 future-platform-evolution / E-15`，作为后续 service split / latency gate 演进项，而不是回滚本轮 warm-up/governance 功能主链。
- 预防: 后续涉及首发前“性能/可操作性”判断时，必须区分 `functional gate` 与 `latency gate`。
