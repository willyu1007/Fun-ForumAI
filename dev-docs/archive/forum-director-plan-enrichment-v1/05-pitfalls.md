# 05 Pitfalls

## Do-not-repeat summary
- `local_intent.soft_constraints` 的 contract 上限是 4，不是 3；root planner 是产品上保留 3 个名额，但 continuity 测试若要触发 schema reject，必须构造超过 4 条的输入。

## 2026-04-21 — Service schema-reject test initially missed the real contract bound
- Symptom:
  - `ForumDirectorPlanEnrichmentService` 的 `schema_rejected` 单测第一次跑成了 `no_effect`。
- Root cause:
  - 测试基线把 `soft_constraints` 设成了 4 条，但 `localIntentSchema.max(4)` 允许 4 条，实际并未越界。
- What was tried:
  - 先看失败输出，确认 service 正常返回了 `no_effect` 而不是 merge 失效。
- Fix/workaround:
  - 把单测中的非法输入调整为 5 条 `soft_constraints`，再重跑聚焦套件。
- Prevention note:
  - 写 schema-boundary regression 时，先对照 `public-director-contract.js` 的真实 `max(...)` 上限，不要把产品策略上限和 schema 上限混为一谈。

## 2026-04-21 — Production-like admin fallback cannot depend on a failing request to infer availability
- Symptom:
  - 第一次修 `RuntimeDashboard` 时，页面虽然能在 `dev/runtime/status` 为 404 时回退到 `admin/runtime/stats`，但浏览器仍会先打一枪 404。
  - 第二次去掉这次 404 后，按钮又被误判为可用，因为 UI 之前把“controls unavailable”绑定在 `devStatus.meta.disabled` 上。
- Root cause:
  - 组件把“环境里没有 dev runtime controls”当成一次失败请求的副作用来推断，而不是显式从 `admin/runtime/stats.runtime.node_env` 判定。
  - 同时首帧条件写成了 `adminStats?.data?.runtime.node_env !== 'production'`，在 `adminStats` 还没回来时会错误地变成 `true`。
- Fix/workaround:
  - 只在 `adminStats` 已加载且 `node_env !== 'production'` 时才轮询 `dev/runtime/status`。
  - `devRuntimeControlsUnavailable` 改成显式环境判断：`stats.runtime.node_env === 'production' || devStatus.meta.disabled === true`。
- Prevention note:
  - 控制面 availability 不要依赖一个“预期失败请求”的副作用；先用稳定的一阶状态做 gating，再把异常/404 作为兼容性兜底。

## 2026-04-21 — Hidden planner timeout defaults can silently neutralize a newly wired entrypoint
- Symptom:
  - `director_plan` 在部署里已经真正活跃，但初次真实验证时始终落到 `planning_audit.director_plan_enrichment.status = llm_failed`。
- Root cause:
  - `hidden-director_plan-base` policy 默认 `timeout_ms=30000`，而真实 `qwen3.6-plus` 规划调用需要约 40s 才完成。
  - provider hard cap 允许 60s，所以失败并不是模型不可用，而是 policy 预算把新增入口静默打回 fail-closed。
- Fix/workaround:
  - 将 `hidden-director_plan-base` / `hidden-director_plan-premium` 默认超时提升到 `60000ms`，重新部署后同一路径成功命中并产出 enrichment。
- Prevention note:
  - 新增 hidden planner callsite 时，除了 unit test 和 wiring test，还要跑一次真实 provider latency probe；否则“入口已接通”可能在运行时被 policy 超时掩盖成“恒定降级”。
