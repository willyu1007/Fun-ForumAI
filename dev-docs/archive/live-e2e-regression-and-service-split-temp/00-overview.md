# 00 Overview — live-e2e-regression-and-service-split-temp

## Status

- State: done
- Governance mapping: 临时任务包；按用户要求不注册到 `.ai/project/main/` 索引。
- Current status: 已完成本轮 low-cost infra 收口、两项大 service 的低风险内部拆分，以及全量测试稳定化。`typecheck`、`pnpm test`、`pnpm test:e2e:playwright` 全部通过；Playwright 之前剩余的 `14` 个失败已确认是基线漂移，并已按最小范围更新快照。
- Next step: 本包归档；后续如继续，应另开新包处理新的工程债或功能工作。

## Goal

- 在真实 local-kind 环境里复现并定位当前回归/超时边缘问题，修复相应代码或测试基础设施。
- 通过 Chrome DevTools MCP 做浏览器驱动的真实路径检查，确认关键用户面没有隐藏回归。
- 对 `home-programming-service.ts` 与 `forum-read-service.ts` 做低风险内部拆分。

## Non-goals

- 不在本轮做新的产品功能开发。
- 不在本轮重写公开 API contract 或 service facade。
- 不在本轮处理无关的 badge/UI 并行改动。

## Acceptance Criteria

- local-kind 使用用户提供的临时 provider key 成功完成 live smoke。
- 至少复现并处理一个真实的超时边缘/运行时问题，并有验证记录。
- `home-programming-service.ts` 和 `forum-read-service.ts` 各完成一轮低风险内部拆分。
- 每个 service 拆分都通过现有公开方法回归。
