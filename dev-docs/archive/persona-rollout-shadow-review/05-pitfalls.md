# 05 Pitfalls — T-070

## Do-not-repeat summary
- 不要在 0 个 `migrated_visible` 样本时把 gate 判绿。
- 不要把 blind review / shadow logging 执行重新塞回 `T-066`。

## 2026-03-09 - rollout evidence 不能与 observability contract 混装
- Symptom: `T-066` 已完成 contract/runtime 接线，但因为真实样本和盲评尚未执行，任务状态长期停在 `in-progress`。
- Root cause: contract closeout 与 rollout execution 的验收面不同，却被放在同一任务里管理。
- What was tried: 先完成 `T-066` 的 contract/runtime closeout，再单独建立 follow-up task 承接真实证据。
- Fix/workaround: 新建 `T-070 persona-rollout-shadow-review`，专门处理样本采集、blind review、shadow logging 与 rollout verdict。
- Prevention note: 后续任何“合同已完成但真实灰度证据未齐”的工作，都应拆出独立 rollout task。

## 2026-03-09 - 不要把 rollout gate 规则复制进多个脚本
- Symptom: `T-070` 同时需要可测试的 TypeScript gate 逻辑和可直接 `node` 执行的 `.mjs` 脚本，容易出现两份规则漂移。
- Root cause: 脚本约定使用 `.mjs`，而 runtime/test 逻辑需要走 TypeScript 编译检查。
- What was tried: 先直接把规则写进脚本，再补 TS 模块；这会让后续修改必须双改。
- Fix/workaround: 将合并逻辑固定在 `src/backend/runtime/persona-rollout-gate.ts`，再由 `.mjs` 脚本通过 `tsx/esm/api` 复用该模块。
- Prevention note: 后续任何“脚本 + TS 运行时共享规则”的场景，都优先采用可复用模块 + loader 方式，不要手工维护两套判定逻辑。

## 2026-03-09 - 真实 shadow run 可能暴露 runtime drift，而不是 orchestration 失败
- Symptom: `T-070` 脚本能成功触发 `scheduled_post` / `private_chat` 并拿到新的 agent runs，但 `t066-persona-eval` 仍然看到 `observed_runs_total=0`。
- Root cause: 当前 local-kind backend 产生的是 legacy-style `agent_runs.output_json`，没有 `persona_observation`；同时 `POST /v1/dev/runtime/post` 还伴随 `posts_community_id_fkey` 写入失败。
- What was tried: 先把 `/v1/dev/seed` 的 `500` 降级为可恢复 warning，再重跑真实 shadow review 并对比 `target-agent-runs.json` 与 `gate-summary.pre-review.json`。
- Fix/workaround: 在 `T-070` 中显式记录 `shadow_activity.target_agent_run_count` 与 `observed_runs_total`，把“有真实 runs 但 0 个 persona_observation”的情况标成 blocking issue。
- Prevention note: 后续任何 rollout shadow task，在看到 callsite delta 为 `0` 时，都必须二次检查真实 run 是否已生成，避免误判成“没有流量”。

## 2026-03-09 - 不要把 `triggered=true` 误当成 public path 成功
- Symptom: `/v1/dev/runtime/post` 返回 `triggered=true`，但 `post_id=null` 且 `error` 已明确是 FK 失败；旧版脚本仍继续把它当作 warmup/follow-up 成功。
- Root cause: 旧逻辑只看 scheduler 是否触发，不看 post 是否真正写入。
- What was tried: 将 success 条件收紧为 `triggered=true && post_id!=null && error empty`，并把其余情况统一标记成 `write-failed`。
- Fix/workaround: `scripts/t070-rollout-shadow-review.mjs` 现会在 warmup/follow-up 中显式区分 `ok / other-agent / write-failed / noop`，并在无法拿到 persisted owner public post 时 fail fast。
- Prevention note: 后续任何 shadow / rollout 证据脚本，都必须优先验证“副作用是否真正落库”，不能只看 trigger flag。

## 2026-03-09 - fallback/degraded 切片可能“被选中但不可评审”
- Symptom: `fallback_or_degraded` 在 corpus 中有 8 个样本，但 blind review sheet 里所有 excerpt 都是 `[[content unavailable]]`。
- Root cause: 当前切片挑选逻辑能识别“候选 run”，但这些 run 并不保证带可供人工评审的文本载荷。
- What was tried: 本次 finalize 没有强行给这些样本打分，而是把该切片保留为 `incomplete-review`，并在最终 verdict 中显式保留 `hold`。
- Fix/workaround: 将 `review-results.json` 中这 8 个样本保留为 `null` 分数并附注 evidence gap；让最终 snapshot 反映“证据不足”而不是伪造通过或武断失败。
- Prevention note: 后续若继续迭代 T-070 类任务，切片生成器应额外校验 blind-review excerpt 是否可见，再把样本计入 required slice。
