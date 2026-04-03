# 05 Pitfalls

## Do-not-repeat

- 不要把 ECS host env-file 上传链路直接套到 ECI；ECI 需要 container-group replacement 语义。
- 不要在 cloud target contract 里混入 secret value；worker rendered manifest 只能记录 secret ref / backend 预览。

## 2026-04-03 - Compile verification without `bws`

- Symptom:
  - `env-localctl compile` 在本机无法完成真实 staging/prod env-file 生成，因为 `bws` CLI 不在 PATH 中。
- What we tried:
  - 先直接运行真实 compile，记录失败原因；再使用临时 mock `bws` 仅验证编译产物的键集合与 omission。
- Fix / workaround:
  - 保留真实失败记录作为 operator 前置条件，同时用 mock `bws` 验证 `.env` 中确实不再出现 `LLM_PROVIDER / LLM_MODEL / LLM_BASE_URL`。
- Prevention:
  - 以后把“compile PASS”写进 go-live 验收时，必须区分“真实 deploy-time secret resolution”与“仅合同形状验证”；前者要求 operator 机器安装并登录 `bws`。

## 2026-04-03 - Cloud context artifact naming drift

- Symptom:
  - `docs/context/env/effective-cloud-staging.json` 与 `docs/context/env/effective-cloud-prod.json` 同名文件分别来自不同 workload，容易让后续开发误把单次 `api/worker` 快照当成统一 cloud SSOT。
- What we tried:
  - 先核对 `env-cloudctl` 的 context writer 与 repo 中现存文件，再对照 `policy.env.cloud.targets` 的 workload-aware 设计确认歧义来源。
- Fix / workaround:
  - 把 cloud/local redacted context 产物统一改成 workload-aware 命名，并删除旧的 env-only cloud context 文件；worker context 额外保留 `base_config` 以说明 role override 来源。
- Prevention:
  - 只要 context artifact 会随着 `workload` 变化，就不能再用 env-only 文件名；否则必须在 contract 中明确它只是某个默认 workload 的快照。

## 2026-04-03 - Shared `RUNTIME_ENABLED` conflicted with role authority split

- Symptom:
  - `env/values/staging.yaml` 仍包含共享的 `RUNTIME_ENABLED=true`，与 `api` 侧 “compose-owned false” 的 contract 形成潜在双轨。
- What we tried:
  - 先核 `compose.yaml`、worker env matrix 与 cloud context，确认真正的 authority split 已经存在，只是共享 values 还保留旧值。
- Fix / workaround:
  - 删除共享 `RUNTIME_ENABLED=true`，保留 contract default=false；`api` 最终值继续由 `compose.yaml` 固定，`worker` 通过 env matrix / role contract 抬升为 true。
- Prevention:
  - 对于角色专属开关，不要放进 shared env values；应由 workload contract 或 runtime target-specific asset 独占维护。

## 2026-04-03 - Prod baseline was blocked by contract scope drift

- Symptom:
  - 在为 `prod` 补 production/redis/s3 baseline 时，`env-cloudctl plan --env prod` 报 `DB_PERSISTENCE` out-of-scope，说明 contract 仍停留在 “staging-only rehearsal” 语义。
- What we tried:
  - 对照 `env/values/prod.yaml`、`env/contract.yaml` 与 go-live runbook，确认问题不是 values 写错，而是 contract 没有正式接纳 `prod` cloud baseline。
- Fix / workaround:
  - 把 `DB_PERSISTENCE` scope 扩到 `staging,prod`，并补齐 `env/values/prod.yaml` 的 production/redis/s3 baseline，再重新运行 plan/generate。
- Prevention:
  - 当 runbook 已把某个 env 视为正式 cloud target 时，env contract scopes 必须同步放行该 env；否则会出现“文档允许、contract 拒绝”的假闭环。
