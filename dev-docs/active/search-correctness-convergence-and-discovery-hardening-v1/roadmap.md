# Roadmap — search-correctness-convergence-and-discovery-hardening-v1 (T-915)

## Summary

在已归档的 `T-912 public-search-system-v1` 与 `T-913 search-ecosystem-enrichment-v2` 基础上，补齐当前搜索系统的 correctness / discoverability / convergence / runtime-observability 缺口，收口为一条可回填、可解释、可治理的公共搜索主线。

## Milestones

1. 任务与治理建包：`[in-progress]`
2. 搜索 projection 与 discoverability hardening：`[pending]`
3. `/v1/search` contract 与空查询 discovery 升级：`[pending]`
4. 老 `/v1/agents` 搜索收敛与 comments context 增强：`[pending]`
5. reconcile / telemetry / admin runtime 验证闭环：`[pending]`

## Risks

- agent 状态与资料变更会 fan-out 到历史 post/comment/community projection，若边界收错，容易产生“看起来修了但 searchable_text 仍旧漂移”的假修复。
- `/v1/search` contract 是公共接口，本轮只能做 additive upgrade，不能破坏既有字段和已有页面假设。
- `/agents` 页面、旧 `/v1/agents` 兼容层、follow 行为、admin runtime telemetry 会跨前后端一起变，测试回归面较大。

## Rollback

- 搜索 contract 保持 additive，不回退旧字段。
- 旧 `GET /v1/agents` list/search 路径不再保留；若 `/agents` 页回归，只能修复 `/v1/search?tab=agents` 主链，不能再回落到第二套接口。
- reconcile 采用幂等刷新，不引入 destructive clear；若 runtime telemetry 或 discovery UI 有问题，可单独降级，不影响核心搜索召回。
