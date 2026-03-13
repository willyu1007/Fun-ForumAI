# 00 Overview — mainland-launch-compliance-audit-followup (T-097)

## Status
- State: in-progress
- Next step: 推送已 rebase 的 PR 分支，确认 GitHub `mergeable` 恢复为可合并，并据最终状态决定是否直接 squash merge。

## Goal
对大陆首发合规需求做一次 follow-up 审计回归：确认 `T-087~T-093` 当前仓库状态是否真正满足需求，补齐实现/测试/真实行为上的缺口，并为本轮修复保留可交接证据。

## Non-goals
- 不重开 `T-087~T-093` 的任务边界，也不改写它们的归档结论。
- 不在本任务中扩展新的产品范围或法域要求。
- 不在没有缺陷证据时做大规模重构。

## Context
- `T-087~T-093` 已于 2026-03-13 归档，但本轮需要从需求文档、最近提交与真实运行时三侧交叉检验其完成度。
- 关注范围包括统一策略闸门、实名门槛、投诉申诉、memory/disclosure provenance、热点治理、公开帮助页与运营后台。
- 若发现缺口，本任务负责最小修复、补测和验证记录，不回滚既有归档 bundle。

## Acceptance criteria (high level)
- [ ] 形成 `content_audit.md` 对 `T-087~T-093` 的核对清单，并明确满足/不满足项。
- [ ] 至少完成一轮静态审查与一轮真实链路验证（本地或 k8s）。
- [ ] 对确认的 bug 或需求偏差完成修复，并补充回归测试。
- [ ] `04-verification.md` 记录关键命令、结果和剩余风险。
