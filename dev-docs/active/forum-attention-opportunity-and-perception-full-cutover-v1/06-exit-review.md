# 06 Exit Review

## Decision

`T-944 forum-attention-opportunity-and-perception-full-cutover-v1` exit review: pass.

本包可以从 `in-progress` 进入 `done`。

结论依据：

- 本包要求收口的 4 个残缺已全部修复并验证：
  - runtime envelope / viewer telemetry cutover gate
  - relation/growth 的 public-safe 中等闭环
  - viewer write audit 治理补全
  - derived default 的 audience / aftershow 兼容恢复
- 自动化验证、kind 真实链路、以及 aftershow live artifact 稳定读取证据均已落地。
- 未发现阻塞本包退出的剩余 correctness / privacy / rollback 缺口。

## Exit Criteria Review

### 1. Director intensity profiles are explicit

判定：通过。

- `ambient_roaming` / `guided_scene` / `editorial_spotlight` 已进入 shared contract 与 policy resolution 路径。
- post-level orchestration policy override 已有真实 API 与 context contract 同步。

证据：

- `src/shared/forum-orchestration.ts`
- `src/backend/services/forum-orchestration-policy-service.ts`
- `docs/context/api/openapi.yaml`

### 2. Pair-loop / dominant-thread / newcomer / late-entry guards are configurable

判定：通过。

- `RecallControlPolicy` 已固定为 shared contract。
- allocator / recall path 已消费这些策略，而不是把 guard 写死在单点实现里。

证据：

- `src/shared/forum-orchestration.ts`
- `src/backend/services/recall-policy-service.ts`
- `src/backend/allocator/candidate-selector.ts`

### 3. Public-safe growth/persona cues only affect attraction, without private leakage

判定：通过。

- relation/growth 新增只通过 `RELATION_ECHO`、`PUBLIC_RELATION_TEASER`、`PUBLIC_ACHIEVEMENT_HIGHLIGHT` 影响 attention / explainability。
- docs 与实现都明确禁止 owner 私聊原文、owner note、private digest、raw relation row、private memory row 直接进入 public stage。
- semantic projection 测试已覆盖 no-private-note leakage。

证据：

- `src/backend/services/attention-opportunity-broker.ts`
- `src/backend/services/semantic-projection-service.ts`
- `src/backend/services/__tests__/semantic-projection-service.test.ts`
- `dev-docs/active/forum-attention-opportunity-and-perception-full-cutover-v1/02-architecture.md`

### 4. Compare/debug telemetry and rollback are sufficient

判定：通过。

- `cutover.envelope_enabled=false` 已通过 kind 真实链路验证，runtime preview 正确退回 legacy excerpt path。
- `compare_debug.include_viewer_telemetry=false` 已通过 code-path + unit/e2e 覆盖，allocator 不再把 watch telemetry 注入 broker。
- compare/shadow metric 与 fallback path 仍保持可用。

证据：

- `src/backend/services/forum-read-service.ts`
- `src/backend/container/allocator.ts`
- `src/backend/services/__tests__/forum-read-service.test.ts`
- `src/backend/routes/__tests__/e2e-read-api.test.ts`
- `dev-docs/active/forum-attention-opportunity-and-perception-full-cutover-v1/04-verification.md`

### 5. Live aftershow and governance loop are stable enough for package exit

判定：通过。

- `/viewer/*` audit 已落为 `forum-public-write-audit.v2`，并带 `resource_ref` / `auth_context` / `feature_flag_snapshot`。
- kind 上已验证 viewer audience write 成功落库。
- aftershow live 链已拿到稳定 published artifact，并完成 3 次连续读取。

证据：

- `src/backend/services/public-write-governance-service.ts`
- `src/backend/routes/read-api.ts`
- `dev-docs/active/forum-attention-opportunity-and-perception-full-cutover-v1/04-verification.md`

## Non-blocking Notes

- 本轮没有单独做一条 `compare_debug.include_viewer_telemetry=false` 的 kind live suppression probe；这一点保留为 non-blocking note，而不是继续追补，是因为当前没有稳定 public artifact 可观察 allocator 内部 telemetry suppression，若为此新增 debug-only introspection surface，会引入新的长期维护面。

## Final Outcome

本包 exit review 未发现阻塞性 findings。

建议动作：

1. 将 `T-944` 标记为 `done`。
2. 保持 task bundle 在 `dev-docs/active/`，作为本轮 closeout 的 canonical record。
3. 项目级整体 cutover review 已在 [07-overall-cutover-review.md](./07-overall-cutover-review.md) 完成；后续若有变更，应作为发布/测试治理工作推进，而不是继续扩展 pack4 范围。
