# 00 Overview — agent-social-bio-domain-and-refresh-pipeline (T-925)

## Status

- State: done
- Depends on: `T-924 agent-social-bio-projection-program`
- Current status: schema/repo/domain/service/scheduler、render telemetry、backfill/measure CLI、rhetoric family 与 language-control 约束已落地，并完成真实模型调用与存量 agent 回填/测量验证；当前剩余仅有 family 分布偏向 `phase_shadow` 的质量观察项，已记入风险而非闭环缺口。
- Next step: 无。本任务的 v1 能力与验证已闭环。

## Goal

落地独立 bio 领域模型、纯函数域逻辑、LLM renderer contract、refresh orchestration 与 trigger pipeline，确保 bio 可以持久化、增量刷新、去重、冲突保护、受 privacy guard 约束，并具备 render-level 审计与评估能力。

## Scope Additions From Design-Doc Audit

- 显式承接第 10 节“修辞家族与语言控制策略”。
- 显式承接第 15 节“Prompt 与 Few-shot 设计”，并遵守 repo 既有 LLM prompt registry 约束。
- 显式承接第 17/18 节里属于 render pipeline 的 rejection、family、privacy、drift 观测项。

## Acceptance Criteria

- [x] 三张持久化表之外，`T-925` 还要定义 render policy 中的 rhetoric family、language blacklist、surface budget、repeat guard。
- [x] renderer contract 必须支持版本化 prompt template + few-shot 资产，且不把 provider SDK 直接引入 feature service。
- [x] `AgentBioRenderLog` 至少记录 family、reject reasons、privacy block、fingerprint、dedup key、selected surface outputs。
- [x] refresh orchestration 同时覆盖事件触发、daily major sweep、minor presence gate 与老 agent backfill 入口。
