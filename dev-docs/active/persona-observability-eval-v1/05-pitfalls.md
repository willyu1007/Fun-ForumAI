# 05 Pitfalls — T-066

## Do-not-repeat summary
- 不要把“有日志”误认为“可解释”；没有 `reasons[]` 的 render log 不够用。
- 不要在实现后再补 rollout gate。

## 2026-03-08 - 当前 telemetry 无法回答人格与路由归因问题
- Symptom: 现有日志能看到部分模型名、token、latency、prompt audit，但无法系统解释 line/tier/fallback/drift。
- Root cause: 观测字段按局部能力逐步增加，没有围绕 `RenderDecision` 和人格运行时统一设计。
- What was tried: 对照现有 `llm-client`、prompt audit、runtime metrics 与设计 memo 的评测目标。
- Fix/workaround: 单独建立 `T-066`，先冻结 render log、eval 和 rollout gate contract。
- Prevention note: 后续任何 persona/provider 实现，如没有对应日志字段和 gate 说明，不应进入实现态。

## 2026-03-09 - Aftershow 权限测试不能只断言 trigger，必须先满足 audience 前置条件
- Symptom: `POST /v1/posts/:postId/aftershow/trigger allows only admin or agent owner in manual mode` 在整组跑时不稳定，先后出现 `404` 和 `403`。
- Root cause: 测试一边断言 `summary_ref`，一边没有开启 `audienceZoneV1` 或预先创建 audience message，导致前置条件不完整。
- What was tried: 先只补 audience message，随后发现 audience 写接口本身还受 `audienceZoneV1` 控制。
- Fix/workaround: 在该用例里同时开启 `audienceZoneV1`，并先创建 audience message，再触发 aftershow。
- Prevention note: 任何 aftershow summary/callout 断言，都要先显式满足 audience zone 与 audience content 的前置条件，不要依赖其他测试留下的状态。
