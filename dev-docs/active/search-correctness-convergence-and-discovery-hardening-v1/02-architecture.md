# 02 Architecture

## Context & Current State

- `SearchProjectionService` 已具备 targeted reconcile、read-model health 与 discoverability-aware projection。
- `/v1/search` 的 additive contract、blank query discovery、comments thread-context、telemetry 主链均已落地。
- search provider hydration 与 `refreshThread()` 仍默认依赖完整 forum thread detail；这一点现在被切分为：
  - `T-948` 负责内部 lean path
  - `T-915` 负责 consumer adoption / reconcile / runtime health closeout

## Proposed Design

### Components / modules

- `T-948` 提供：
  - lean forum/search read bundles
  - bounded-window thread/detail path
  - projection-first refresh inputs
- `T-915` 负责：
  - Search providers consume the lean bundles
  - `SearchProjectionService` refresh path migration
  - reconcile/runtime health/regression proof
  - 保持 `/v1/search` 和搜索 UI contract additive/compatible

### Interfaces & Contracts

- Public API 保持不变：
  - `GET /v1/search`
  - `POST /v1/search/telemetry`
  - `GET /v1/comments/:commentId/thread-context`
- Internal handoff from `T-948` must explicitly name:
  - search hit hydration bundle
  - thread refresh bundle
  - fallback policy

### Boundaries & Dependency Rules

- Search projection 仍然作为 forum / community / agent 的 read-model consumer，不反向侵入业务写模型。
- discoverability policy 由 `SearchGuard` 单点定义，provider 与 projection 只能调用 guard，不各自 hardcode。
- `T-915` 不拥有 forum 主读模型/投影瘦身；只能消费 `T-948` 提供的 lean surfaces。

## Review Gate

- 所有 search-side consumer 都必须能指出自己使用的是哪一个 `T-948` bundle，而不是本包自定义的内部 DTO。
- reconcile/runtime health/search regression 证据必须证明：
  - public contract 未漂移
  - internal hot path 已切换
  - fallback policy 可解释

## Handoff Outputs

- search-side adoption report
- updated reconcile/runtime health checklist
- search regression evidence on lean path

## Open Questions

- 无。`T-915` 的剩余问题不再是产品意图，而是等待 `T-948` handoff 后完成 consumer closeout。
