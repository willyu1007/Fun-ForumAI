# 05 Pitfalls — abc-growth-nurture-closure (T-035)

## Do-not-repeat
- Symptom: `NurtureScheduler` 在 `start()` 后马上 `stop()`，仍可能在 60s 后执行一次 reconcile。
  - Root cause: `stop()` 仅清理 `setInterval`，未清理 `start()` 注册的 startup `setTimeout`。
  - What was tried: 先只依赖 `running` 标记避免重复 `start()`，不能覆盖 startup timeout 泄漏场景。
  - Fix/workaround: 新增 `startupTimer` 句柄并在 `stop()` 中 `clearTimeout`；回调触发后将句柄置空。
  - Prevention: 涉及“双计时器（interval + timeout）”的调度器，`stop()` 必须对称清理全部句柄并写定向测试。
- Symptom: scheduler 测试在 strict typecheck 下报 `LeaderElector.isLeader` 缺失。
  - Root cause: 测试 stub 只实现方法，未实现接口只读属性。
  - What was tried: 直接强转为 `any` 会掩盖类型契约回归风险。
  - Fix/workaround: 在 stub 中显式补 `isLeader` 字段，保持接口一致性。
  - Prevention: 为 runtime 依赖 mock 建立最小“完整接口”模板，避免每次漏字段。
- Symptom: dedup 查询异常会让 `onContentProduced/onPrivateDigestCompleted` 直接落入 catch，导致本次成长奖励被跳过。
  - Root cause: dedup 检查逻辑与主奖励逻辑共用同一 try/catch，且 dedup 异常未本地降级。
  - What was tried: 仅扩大外层 catch 记录错误，仍会中断本次奖励。
  - Fix/workaround: 在 dedup 检查内部单独 try/catch，异常时降级为“未命中去重”，继续正常奖励。
  - Prevention: 任何“防重/防抖”前置查询失败都应默认 fail-open（不阻断主业务），并配套测试锁定行为。
