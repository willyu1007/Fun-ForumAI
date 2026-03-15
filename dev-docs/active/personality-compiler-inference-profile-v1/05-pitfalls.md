# 05 Pitfalls

## do-not-repeat
- Symptom: `collect_shadow_review` 在 e2e 中拿到 `reject/hold`，即使提前插入了 3 条 visible success ledger。
  Root cause: `collect` 之前没有明确 `start`，而服务还会隐式创建 review，导致 evidence window 起点落在 ledger 写入之后。
  What we tried: 先加更多 ledger 条目；无效，因为窗口边界本身错了。
  Fix: 取消 `collect` 的隐式建 review，改成 `start -> produce evidence -> collect`，并让 UI 只有在 `running` review 时允许 collect。
  Prevention: 任何 compare/evidence 流都要先冻结 window 起点，再产出证据。

- Symptom: shadow compare 在 e2e / 非 Prisma 容器里长期停在 `growth_locked`，无法进入 `shadow`。
  Root cause: growth gate 依赖 XP summary，而测试/内存容器没有可用的 XP backend。
  What we tried: 只改 stats/persona vector；仍然无法越过 growth gate。
  Fix: 为 `XpService` 增加 in-memory fallback，并在测试里显式补 XP/growth。
  Prevention: 任何依赖 growth gate 的状态机都不能假设“有 stats 就够了”，必须验证 XP path 是否可用。

- Symptom: `approve_shadow` / `collect_shadow_review` 在无效状态下返回 500。
  Root cause: inference profile 服务抛了普通 `Error`，被路由层当成服务器异常处理。
  What we tried: 先从 e2e 侧兜底断言；只能观察到 500，不能修正契约。
  Fix: 改为 `ValidationError`，并新增 invalid transition e2e 覆盖。
  Prevention: 控制面状态机的非法流转必须映射成 4xx 业务错误，不能直接抛裸 `Error`。

- Symptom: 解除 manual lock 后，profile 仍停在 `blocked/manual_lock`。
  Root cause: `setManualVoiceLineLock(false)` 复用了“加锁前”编译结果，解锁时没有重算 blocked reason / migration state。
  What we tried: 直接把 `manual_voice_line_lock` 写成 false；blocked 状态仍残留。
  Fix: 解锁时基于当前 snapshot/growth/risk 重新计算 blockedReason 与 migrationState。
  Prevention: 任何会改变治理门控条件的控制面动作，都不能直接复用旧 compile 结果。

- Symptom: admin 在 profile 页点击 `启动 Shadow Review` 后，页面 refetch 仍看不到 running/collected review，`collect/approve` 按钮被错误禁用。
  Root cause: `GET /v1/agents/:agentId/profile` 的 admin `inference_profile_debug` 只返回 `profile + snapshot`，漏掉了前端实际消费的 `shadowReview`。
  What we tried: 先检查 mutation 返回；只能在 patch 响应 `meta.shadow_review` 里看到 review，refetch 后仍丢失。
  Fix: 读接口补齐 `shadowReview`，并新增 e2e 断言覆盖 start/collect 后的 profile 读面。
  Prevention: 对 control-plane 状态机，不能只测 mutation 响应；必须同时验证 read-model refetch 是否携带同一状态。
