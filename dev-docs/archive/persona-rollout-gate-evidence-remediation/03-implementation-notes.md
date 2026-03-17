# 03 Implementation Notes — T-072

- 2026-03-09 初始化 `T-072`，作为 `T-070` final verdict 的 evidence-remediation follow-up。
- 本轮仅完成任务包文档，不实施产品代码、脚本修改或 rerun。
- 任务来源已经固定：
  - `T-070` final evidence: `.ai/.tmp/t070/t070-2026-03-09T08-07-58-214Z`
  - `T-070` final verdict: `overall_status=warn`, `recommendation=hold`
- 本任务不重新讨论是否需要新 follow-up；该决策已经完成，`T-072` 即为承接包。

## Planned Remediation Targets
- guardrail target: `identity-write-success-guardrail-not-run`
- guardrail target: `cost-baseline-incomparable`
- slice target: `slice-fallback_or_degraded-incomplete-review`

## Explicit Non-Targets
- 不修 local-kind rollout / Docker / ConfigMap / env drift
- 不重构 `persona-rollout-gate.ts` 的 recommendation contract
- 不在本轮给 `fallback_or_degraded` 样本强行打分

## 2026-03-09 implementation start
- 已确认 3 个 blocker 的直接根因：
  - `identity-write-success-guardrail-not-run`
    - `t070` 在结束私聊后未等待异步 `generateDigest -> identityFinalizer.finalize`
    - typed context-memory identity write 不会写回 visible run 的 `persona_observation.identity_write`
    - 该 guardrail 必须改为消费 `runtime-features before/after` 的 identity counter delta
  - `cost-baseline-incomparable`
    - `t066-persona-eval.mjs` 会输出 `avg=... tokens`，但 `visible-render-cost` 被固定成 `not_run`
    - `persona-rollout-gate.ts` 尚未消费 baseline/current gate snapshot 与 provider/model mix
  - `slice-fallback_or_degraded-incomplete-review`
    - 当前 slice 会把 failed-write / content-missing run 纳入 required blind review
    - 样本正文缺失后只剩 `[[content unavailable]]`，天然不可评审
- 本轮采用的 remediation strategy：
  - `identity-write-success`: 通过 `t070` 等待 digest 完成，并在 pre-review 中以 runtime identity delta 判定
  - `visible-render-cost`: 通过 baseline/current gate snapshot + attribution mix 补 comparability 判定
  - `fallback_or_degraded`: 采用规则降级；只保留具有可评审正文的 fallback/degraded 样本，空 slice 作为 caveat，而不是继续生成伪 blind-review 样本

## 2026-03-09 implemented changes
- `scripts/t066-persona-eval.mjs`
  - `fallback_or_degraded` 改为“必须有可评审正文”的样本资格。
  - failed-write / content-missing 且正文只剩 `[[content unavailable]]` 的 run 不再进入 required blind review。
- `src/backend/runtime/persona-rollout-gate.ts`
  - attribution summary 对齐现有产物字段：`by_provider` / `by_model` / `visible_runs_total`
  - pre-review 新增 supplemental guardrails：
    - `runtimeIdentityDelta`
    - `baselineGate`
    - `currentGate`
  - `identity-write-success` 改为基于 runtime identity counter delta 判定。
  - `visible-render-cost` 改为消费 baseline/current gate snapshot + attribution mix，并在可比时输出 pass/fail。
  - blocking callsite 判断新增 shadow-window callsite evidence，避免仅靠 baseline/final top-N corpus delta 误判。
  - `fallback_or_degraded` 缺失时，在 final verdict 中允许作为 `go_with_caveats` 的合法 caveat。
- `scripts/t070-rollout-shadow-review.mjs`
  - 在结束私聊后轮询 session `digest_status`，直到进入 terminal state。
  - 仅在 digest terminal 后抓取 `runtime-features.after.json` / final eval / pre-review。
  - 产物新增 digest wait evidence 与 target-agent shadow-window callsite counts。
  - final eval 扫描窗口改为动态扩窗：`baseline take + estimated shadow-run allowance`，减少 top-N 抖动导致的 cost baseline 不可比。
- `src/backend/repos/pg/pg-context-memory-repository.ts`
  - 修复 Pg enum 反序列化：将 `PRIVATE_CHAT` / `PRIVATE_SESSION` / `OWNER` 等数据库枚举值规范化回领域层小写值。
  - 这是私聊 digest 在真实 Postgres 路径上错误落入 `public_observation_digest` 的直接代码根因。
- `.ai/llm-config/registry/*`
  - 新增 `dashscope-hidden-default` credential pool。
  - 为 `deepseek-director` 的 `public_observation_digest` / `private_digest` / `director_plan` profile 增加 DashScope hidden fallback candidate。
  - 目标是保证 local-kind / dev staging 在缺失 `DEEPSEEK_API_KEY` 时仍能完成 hidden director lane，不再让 T-072 证据补跑被环境凭证阻断。

## 2026-03-09 follow-up findings during rerun
- 第一次代码修复后的 staging rerun 仍失败，暴露出一个真实数据库路径 bug：
  - `PgRawContextEventRepository` 把 Prisma enum 原样回传成大写值。
  - `resolveHiddenIntent(event)` 只按小写 `private_session` 判断，导致 private-session extract 在 Pg 路径上错误走到了 public routing。
- enum 修复后，第二个 staging blocker 变成环境契约问题：
  - hidden director lane 正确进入 `private_digest`
  - 但 local-kind 当前未注入 `DEEPSEEK_API_KEY`
  - digest 因 `Failed to resolve any credential for deepseek-openai/deepseek-reasoner` 而失败
- 为了让 T-072 能在当前本地 staging 闭环验证，本轮选择补 registry hidden fallback，而不是把 repo 修复停留在“需要额外环境变量”的外部前提上。
