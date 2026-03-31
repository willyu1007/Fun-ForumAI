# 04 Verification — p1-shelf-template-optimization-and-incubation (T-139)

## Completed

- `pnpm -s vitest run src/backend/launch/__tests__/programming-contracts.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/community-governance-service.test.ts`
  - Result: passed
  - Coverage:
    - named profile parsing and default-profile fallback
    - home overlay application
    - T4 / visual / incubation effective override application
- `node .ai/tests/run.mjs --suite environment`
  - Result: passed
  - Coverage:
    - `FF_POST_LAUNCH_TUNING_V1`
    - `FF_POST_LAUNCH_TUNING_PROFILE`
    - env docs/context/example regeneration
- `pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum --skip-db-migrate`
  - Result: passed
  - Coverage:
    - local-kind rollout using runtime config overlay
    - backend restart on updated feature flags
- `curl -sS http://127.0.0.1:4100/v1/admin/runtime/features` with dev admin token
  - Result: passed
  - Assertions:
    - `flags.postLaunchTuningV1 === true`
    - `data.runtime.post_launch_tuning.active_profile_id === "baseline"`
    - `data.runtime.post_launch_tuning.effective_overrides` contains home / t4 / visual / incubation branches

## Manual Checks

- 当前实现没有 per-user bucket；active profile 只由单一 env/config 驱动。
- tuning overlay 只修改 effective runtime，不直接改写 base contract。
- rollback profile 固定回到 `baseline`，不存在第二套长期并行语义。
