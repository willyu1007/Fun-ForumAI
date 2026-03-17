# 04 Verification — app-adaptation-discussion (T-028)

## Automated checks

1. `pnpm -s typecheck`
- Result: PASS
- Notes: 主仓 TypeScript 编译全绿。

2. `pnpm -s test`
- Result: PASS
- Notes: 31 suites / 268 tests 全通过；`src/backend/sse/__tests__/hub.test.ts` 含新增 session-scope 用例通过。

3. `pnpm -s mobile:typecheck`（首次）
- Result: FAIL
- Error summary:
  - workspace 依赖未安装（`expo/tsconfig.base`、`react-native`、`expo-secure-store` 未解析）。

4. `pnpm install`
- Result: PASS
- Notes: 完成 workspace 依赖安装与 lockfile 更新。

5. `pnpm -s mobile:typecheck`（修复后复跑）
- Result: PASS
- Notes: 解决 `process` 类型访问问题（改为 `globalThis` 安全读取 env）。

6. `pnpm -s typecheck`（二次确认）
- Result: PASS

7. `pnpm -s test`（二次确认）
- Result: PASS

8. `pnpm -s mobile:test`
- Result: PASS
- Notes: 当前为占位输出 `No mobile tests yet`。

## Manual smoke checks
- 已执行后端端到端 smoke（见第 10、12 项），覆盖 SSE 分级鉴权与私聊实时事件。
- 移动端真机联调（iOS/Android）仍待后续专项执行。

## Rollout / Backout
- Rollout:
  - 先在开发环境验证 SSE 分级鉴权行为（匿名 rooms / 强鉴权 sessions）。
  - 再进行移动端 iOS/Android 联调。
- Backout:
  - 若私聊 SSE 订阅行为异常，可临时回退为 mutation invalidation + 手动刷新（现有路径仍保留）。

9. `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- Result: PASS
- Notes: `[ok] Sync complete.`

10. T-028 端到端冒烟（真实后端 + 临时 Postgres + mock LLM）
- Environment setup:
  - `open -a Docker`
  - `docker pull postgres:16-alpine`
  - `docker run --name funforum-smoke-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fun_forum_smoke -p 55432:5432 -d postgres:16-alpine`
  - `DATABASE_URL='postgresql://postgres:postgres@localhost:55432/fun_forum_smoke' pnpm exec prisma migrate deploy`
  - 本地 mock LLM（`127.0.0.1:4510/v1/chat/completions`）
  - `PORT=4010 DB_PERSISTENCE=true DATABASE_URL='postgresql://postgres:postgres@localhost:55432/fun_forum_smoke' LLM_BASE_URL='http://127.0.0.1:4510/v1' LLM_API_KEY='smoke-key' pnpm -s start`
- Scenario command:
  - `node /tmp/t028-smoke-e2e.mjs`
- Result: PASS
- Evidence summary:
  - 匿名 `rooms` SSE 连接成功并收到 `ROOM_MEMBER_JOINED`。
  - 匿名 `sessions` SSE 返回 401。
  - 非 owner `sessions` SSE 返回 403。
  - owner `sessions` SSE 连接成功并收到 `PRIVATE_MESSAGE_CREATED` 与 `PRIVATE_SESSION_ENDED`。
- Structured output:
  - `checks.anonymousRoomSse=true`
  - `checks.roomJoinEvent=true`
  - `checks.sessionAnonymous401=true`
  - `checks.sessionNonOwner403=true`
  - `checks.sessionOwnerConnected=true`
  - `checks.privateMessageEvent=true`
  - `checks.privateSessionEndedEvent=true`

11. Smoke teardown
- `docker rm -f funforum-smoke-pg`
- Result: PASS

12. Post-smoke remediation verification（修复后复测）
- Environment setup:
  - 临时 Postgres（`55432`）+ `pnpm exec prisma migrate deploy`
  - 本地 mock LLM（`127.0.0.1:4510/v1/chat/completions`）
  - 后端启动：`PORT=4010 DB_PERSISTENCE=true DATABASE_URL=... LLM_BASE_URL=... LLM_API_KEY=smoke-key pnpm -s start`
- Scenario command:
  - `node /tmp/t028-smoke-e2e-fixed.mjs`
- Result: PASS
- Evidence summary:
  - `POST /v1/auth/register` 未携带 token 可正常注册（不再被私聊鉴权拦截）。
  - 匿名 `rooms` SSE 正常；匿名 `sessions` SSE 返回 401；非 owner `sessions` 返回 403；owner `sessions` 正常收私聊事件。
  - 私聊发消息链路复测未再出现 `agent_runs_trigger_event_id_fkey` 错误日志。
- Structured output:
  - `checks.registerWithoutToken=true`
  - `checks.anonymousRoomSse=true`
  - `checks.sessionAnonymous401=true`
  - `checks.sessionNonOwner403=true`
  - `checks.sessionOwnerConnected=true`
  - `checks.privateMessageEvent=true`
  - `checks.privateSessionEndedEvent=true`

13. Post-bugfix verification（代码审查后修复验证）
- `pnpm -s typecheck` => PASS
- `pnpm -s test` => PASS (31 suites / 268 tests)
- `pnpm -s mobile:typecheck` => PASS
- E2E smoke v3 (Postgres + mock LLM) 全链路验证:
  - registerWithoutToken=PASS, login=PASS
  - createAgent=PASS, createRoom=PASS
  - anonymousRoomSse=PASS, sessionAnonymous401=PASS, sessionNonOwner403=PASS
  - startSession=PASS, sendPrivateMessage=PASS (2x PRIVATE_MESSAGE_CREATED)
  - sessionOwnerConnected=PASS, privateMessageEvent=PASS
  - endSession=PASS, privateSessionEndedEvent=PASS
  - 后端日志干净（无 FK 错误、无异常）

## Repo 现状校验（2026-03-17）
- 对照 00-overview 验收条逐项核对仓库代码与 03/04 记录，结论：**文档滞后**，实现已满足 6 条验收。
- 依据：`src/backend/routes/sse.ts`（sessions 参数 + 鉴权）、`private-channel-service.ts`（broadcastToSession）、`use-private-session-sse.ts` + `PrivateChatPage` ChatThread（SSE 刷新）、`apps/mobile` + `token-store.ts`（SecureStore）、04 项 1–13 的 typecheck/test/smoke 记录。
- 已更新 00-overview：6 条验收均勾选为 [x]，Status 备注增加「文档状态（2026-03-17）」。
