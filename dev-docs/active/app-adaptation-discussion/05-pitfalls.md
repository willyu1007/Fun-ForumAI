# 05 Pitfalls (do not repeat) — app-adaptation-discussion (T-028)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 未明确 P1 范围前，不进入任何 App 代码实现。
- SSE 分级鉴权必须保证：`rooms` 匿名可用，`sessions` 强鉴权。
- 在新增 workspace 后，先安装依赖再执行移动端 typecheck。

## Pitfall log (append-only)

### 2026-02-26 - task-initialized
- Symptom: N/A
- Context: 任务包初始化。
- What we tried: N/A
- Why it failed (or current hypothesis): N/A
- Fix / workaround (if any): N/A
- Prevention (how to avoid repeating it): 所有讨论偏差与修正都记录在本文件。
- References (paths/commands/log keywords): `dev-docs/active/app-adaptation-discussion/*`

### 2026-02-26 - mobile-typecheck-before-install
- Symptom: `pnpm -s mobile:typecheck` 报错，提示找不到 `expo/tsconfig.base`、`react-native`、`expo-secure-store`。
- Context: 新增 `apps/mobile` 与 workspace 后，直接执行 typecheck。
- What we tried: 先检查 tsconfig 与代码类型，再确认依赖解析失败。
- Why it failed (or current hypothesis): workspace 新增包后尚未执行 `pnpm install`，导致依赖和配置基座未安装。
- Fix / workaround (if any): 执行 `pnpm install` 后复跑 `mobile:typecheck`，再处理剩余类型问题。
- Prevention (how to avoid repeating it): 任何新增 workspace 包后，先安装依赖，再做对应子项目编译校验。
- References (paths/commands/log keywords): `pnpm-workspace.yaml`, `apps/mobile/*`, `pnpm install`, `pnpm -s mobile:typecheck`

### 2026-02-26 - auth-router-order-smoke-observation
- Symptom: `POST /v1/auth/register` 在未携带 token 时返回 401（而非预期的公开注册行为）。
- Context: DB 持久化模式下执行 E2E 冒烟。
- What we tried: 直接调用 `/v1/auth/register`；后改为带 bypass dev token 调用用于继续冒烟。
- Why it failed (or current hypothesis): `privateChannelRouter` 在 app 挂载顺序上位于 `auth` 路由之前，并且使用了全局 `router.use(requireHumanAuth)`，导致 `/v1/auth/*` 被提前拦截。
- Fix / workaround (if any): 本次冒烟阶段使用 bypass token 继续验证；根因修复需调整路由挂载顺序或收窄私聊路由中间件作用域。
- Prevention (how to avoid repeating it): 将 auth 入口放在任何全局鉴权路由之前，或仅对私聊路径前缀应用鉴权。
- References (paths/commands/log keywords): `src/backend/app.ts`, `src/backend/routes/private-channel-api.ts`, `Missing authentication token`

### 2026-02-26 - private-chat-audit-fk-flake-observation
- Symptom: 私聊发送消息时偶发 `agent_runs_trigger_event_id_fkey` 外键约束错误日志（请求本身仍返回 200）。
- Context: E2E 冒烟第一轮（mock LLM 已启用）中出现一次。
- What we tried: 同场景复跑后未稳定复现（存在偶发性）。
- Why it failed (or current hypothesis): `PrivateChannelService.recordAuditTrail` 中 `eventRepo.create` 与 `agentRunRepo.create` 可能存在持久化时序竞争（未使用事务保证）。
- Fix / workaround (if any): 本轮仅记录风险，未在当前任务内修改行为。
- Prevention (how to avoid repeating it): 后续将私聊审计事件与 agent_run 写入放入同一事务或显式串行等待持久化完成。
- References (paths/commands/log keywords): `src/backend/services/private-channel-service.ts`, `src/backend/repos/pg/pg-event-repository.ts`, `P2003 agent_runs_trigger_event_id_fkey`

### 2026-02-26 - auth-router-order-remediated
- Symptom: `/v1/auth/register` 在匿名场景被提前 401。
- Context: E2E 冒烟后执行针对性修复并复测。
- What we tried: 将私聊鉴权从路由级全局中间件改为 endpoint 级；并把 auth 路由挂载提前。
- Why it failed (or current hypothesis): `/v1` 下私聊路由全局鉴权作用域过宽，且挂载顺序在 auth 之前。
- Fix / workaround (if any): 已修复并复测通过。
- Prevention (how to avoid repeating it): 公开入口路由（如 auth）必须先于强鉴权路由挂载；鉴权中间件优先按 endpoint 收敛作用域。
- References (paths/commands/log keywords): `src/backend/app.ts`, `src/backend/routes/private-channel-api.ts`, `registerWithoutToken=true`

### 2026-02-26 - private-chat-audit-fk-flake-remediated
- Symptom: `P2003 agent_runs_trigger_event_id_fkey` 偶发。
- Context: 私聊审计链路修复后进行 E2E 复测。
- What we tried: 在 Pg 仓储层增加 in-flight event 写入跟踪，agent_run 写入在同进程内等待 trigger event 持久化完成。
- Why it failed (or current hypothesis): 原实现为异步 fire-and-forget，event 与 agent_run 持久化存在时序竞争。
- Fix / workaround (if any): 已修复并复测通过。
- Prevention (how to avoid repeating it): 对存在 FK 依赖的异步持久化路径，必须保证明确的写入顺序（事务或串行等待）。
- References (paths/commands/log keywords): `src/backend/repos/pg/pg-event-repository.ts`, `pendingEventWrites`, `agent_runs_trigger_event_id_fkey`
