# 01 Plan

## Phases

1. Phase A: inventory heavy paths and freeze migration targets. `[pending]`
2. Phase B: slim summary/detail forum read paths. `[pending]`
3. Phase C: slim search refresh and search hydration paths. `[pending]`
4. Phase D: migrate orchestration/runtime consumers to lean bundles. `[pending]`
5. Phase E: hand off search consumer closeout to `T-915`. `[pending]`

## Entry Contract

- 开工前必须接受：
  - `T-941` 的 lifecycle/projection truth
  - `T-945` 的 frozen anchor semantics
  - `T-947` / `T-942` 已基本冻结行为语义，避免性能包反向改变产品语义
- 若还无法明确区分“必须保留的 full-detail fallback”和“默认热路径”，先冻结 inventory，再进入实现。

## Detailed Steps

- Audit the current heavy paths:
  - `buildProjectionBundle()`
  - `listAllVisibleTurnsByThread()`
  - `getThreads()` summary hydration
  - search provider hydration
  - search projection refresh
- Define the minimum internal bundle set needed for Phase 2:
  - lean post summary/projection bundle
  - bounded thread detail bundle
  - search card projection bundle
  - orchestration/runtime read bundle
- Define cache/version/fallback policy for high-frequency semantic projections:
  - post capsule
  - thread capsule
  - reading guide
  - discussion forest
- Refactor repositories/services so the heavy path becomes an explicit fallback, not the default.
- Migrate search consumers in a way that preserves current public search contract while removing the full-thread dependency.
- Document the exact handoff contract that `T-915` must consume.

## Handoff Review Before Next Pack

- 在 `T-915` 进入 consumer closeout 前，必须 review：
  - lean bundle inventory 是否冻结，并逐项注明 intended consumer / maximum data shape / fallback path
  - search hydration、projection refresh、thread detail、orchestration/runtime bundle 是否都已有替代热路径
  - cache/version/fallback policy 是否足以防止重新回退到 full-thread default
- review 输出必须落到：
  - `03-implementation-notes.md`：lean bundle inventory + call-site migration list
  - `04-verification.md`：hot-path comparison / regression evidence

## Stop / Escalation Conditions

- 若 search hit hydration 或 refreshThread 仍默认依赖完整 thread detail，本包不得交接给 `T-915`。
- 若 lean bundle 只能靠新增 public API 或持久化 schema 才能成立，必须先升级到 `T-946` adjudication，而不是在本包内偷偷扩 scope。

## Exit Criteria

- `00-overview.md` acceptance criteria are satisfied.
- The handoff bundle for `T-915` exists and names the new lean surfaces explicitly.
- Verification evidence includes at least one hot-path comparison or regression proof for each of:
  - thread detail
  - search hydration
  - projection refresh
  - orchestration/runtime bundle
