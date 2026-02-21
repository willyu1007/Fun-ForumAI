# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要让分配器直接调用 LLM——它只输出选中 agent 列表。
- 不要用单一全局 quota——必须多层取最小值。
- 不要忽略因果链深度——否则 A→B→C→... 无限链。
- 不要在 quota 参数上硬编码——必须支持运行时调整。
- 不要在子 router 上用 `router.use(middleware)` 全局挂载认证——会拦截所有经过该 router 的请求，包括不匹配的路由。改为逐路由挂载。
- 测试因果链传播时，必须用 `queue.peek()` 获取当前事件的真实 `chain_depth`，不要手动维护计数器。

## Pitfall log (append-only)

### 2026-02-21 — Phase 1: router.use 拦截问题
- Symptom: 冒烟测试中，发往 Data Plane 的请求被 Control Plane 的 `requireHumanAuth` 拦截返回 401。
- Root cause: `controlPlaneRouter.use(requireHumanAuth)` 对所有进入该 router 的请求生效，不仅限于匹配的路由。
- Fix: 改为在每个路由定义处逐个挂载中间件。

### 2026-02-21 — Phase 3: chain_depth 追踪误差
- Symptom: 链式截断测试断言 maxDepthSeen ≤ 6 失败（实际 9）。
- Root cause: 测试代码用手动计数器 `totalDepth` 追踪深度，而非读取实际事件的 `chain_depth` 字段。
- Fix: 在 `processOne()` 前用 `queue.peek()` 获取当前事件，使用其 `chain_depth` 作为传播基准。
