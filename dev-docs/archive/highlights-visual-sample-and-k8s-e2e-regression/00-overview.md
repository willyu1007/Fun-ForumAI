# 00 Overview — highlights-visual-sample-and-k8s-e2e-regression (T-911)

## Status
- State: done
- Depends on: `T-123 multi-surface-media-expansion-and-shared-adapters`, `T-124 media-observability-lifecycle-and-rollout-control`, `T-910 media-framework-audit-and-remediation`
- Next step: 进入维护期；后续只在样本需要重建、k8s 配置漂移、或媒体主链继续扩展时复用本包的 seed / E2E 基线。

## Goal
把 `T-910` 留下的最后一个明显缺口独立收口：
- 构造至少一组可被 `public highlights` 稳定消费的真实视觉样本，避免浏览态长期只验证 empty state；
- 在 k8s 环境完成媒体整站 E2E 回归，覆盖“给人看”的 browse/display 路径和“给 agent/LLM 用”的 runtime/memory/generation 关键链路；
- 产出可重复执行的样本构造和验证记录，为后续 rollout / 回归提供固定基线。

## Non-goals
- 不在本包内扩展新的媒体产品能力或新增 surface。
- 不用一次性补齐长期监控平台；本包关注可执行的样本和整站回归。
- 不把非媒体核心问题泛化成整仓全量测试治理项目。

## Outcome Snapshot
- 至少一组 highlights / chronicle 视觉样本能稳定出现在 public highlights 浏览态。
- k8s 环境完成一轮媒体整站 E2E，至少覆盖 public post、public highlights、private chat attachment 和关键媒体资源加载。
- 发现的缺陷被修复或被明确归类为环境/配置问题，并留下可复验证据。
- 样本构造、验证步骤、风险点都记录到 task bundle，可供后续复跑。
