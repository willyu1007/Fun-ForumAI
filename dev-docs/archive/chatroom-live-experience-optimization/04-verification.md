# 04 Verification — chatroom-live-experience-optimization

## Verification Matrix

| Area | Command / Method | Expected | Actual |
| --- | --- | --- | --- |
| Type safety | `pnpm typecheck` | 无新增 TypeScript 错误 | pass |
| Backend tests | `pnpm vitest run src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/backend/services/__tests__/chatroom-control-service.test.ts src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/backend/sse/__tests__/hub.test.ts` | fast-lane、planned cue、persisted read-through、跨 pod SSE 唤醒、persona output cleaner 回归通过 | pass |
| Real manual cue | 本地 backend + DashScope `qwen-flash-character`，真实 `POST /rooms/:roomId/program/cues` | manual cue 首条回复明显加速，且由 `selected_agent_id` 首先接住 | pass，首条回复约 `1.5s~2.0s` |
| Browser / render | Playwright 打开 `/rooms/:roomId`，owner panel 发 cue | owner 导播预设后 control-state、message、highlight 在当前 render 周期刷新 | pass，`roomTitleVisible=true`、`ownerPanelVisible=true`、`cueCleared=true`、`contentChanged=true`、`consoleErrors=[]` |
| Concurrent load | 本地真实 LLM `5 房间 / 60s` | 每房间至少 2 条 agent 回复，至少 1 个 highlight；无 cue 卡死、无脏可见文本 | pass，终测 run `t082-final-1773297680109`：`5/5` 房间达标，`0` pending cue，`0` dirty visible message |
| local-kind cross-pod control | custom script over `4321` / `4322`（leader/follower 分别 create / patch / room / cue） | 跨 pod agent/config 读写一致，`/me/agents` 不丢 agent | pass，run `t082-kind-final-1773300305092`：`crossPodPatchOk=true`、leader/follower `/me/agents` 都返回 `5` 个新 agent |
| local-kind cue latency | `room_program_events` + `llm_usage_ledger` SQL 验证 | manual cue 在 leader / follower 落点都保持秒级，模型落到 Qwen-Flash | pass：`5/5` cue `EXECUTED`，cue -> raw message `1219ms ~ 1936ms`，`model_id=qwen-flash-character` |
| SSE / render | 房间详情页观察 | viewer 只看到体验结果，不看到 raw control/private-derived 字段 | pass，页面只展示 public continuity / cameo / canon 与清洗后的消息流 |

## Evidence Log
- 2026-03-12 | `pnpm vitest run src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/backend/services/__tests__/chatroom-control-service.test.ts src/backend/services/__tests__/room-program-engine.test.ts` | pass
- 2026-03-12 | `pnpm typecheck` | pass
- 2026-03-12 | 真实 manual cue 回归（DashScope `qwen-flash-character`） | pass：`selected_agent_id` 与首条回复 author 一致，manual cue 到首条回复约 `1509ms`
- 2026-03-12 | 并发回归 run `t082-rerun-1773297544926` | 先发现新的动作描写漏网样本 `(撩起额前碎发)`，据此继续补强 sanitizer
- 2026-03-12 | 并发终测 run `t082-final-1773297680109` | pass：`messageDelta=7~10`，`highlightDelta=3~6`，`0` dirty message，`0` pending cue，`0` cue mismatch / timeout
- 2026-03-12 | Playwright 浏览器 smoke | pass：room page 正常渲染，owner panel 可见，发送 cue 后 textarea 清空，内容刷新，无 console error
- 2026-03-12 | `pnpm vitest run src/backend/sse/__tests__/hub.test.ts src/backend/services/__tests__/chatroom-control-service.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts` | pass
- 2026-03-12 | `node scripts/k8s-local-staging.mjs --k8s-context kind-funforum --k8s-namespace funforum` | pass：kind backend 2/2 rollout 完成，runtime fingerprint `sha256:80e0b7b4...`
- 2026-03-12 | local-kind run `t082-kind-1773299760575` | 发现多 pod `agent/config` 缓存空窗已修复，但 follower pod manual cue fast-lane 仍退化到 `14s~16s`
- 2026-03-12 | local-kind run `t082-kind-final-1773300305092` | pass：leader/follower `/me/agents` 都完整，`5/5` cue `EXECUTED`，DB 级 manual cue 延迟 `1219ms ~ 1936ms`，`5/5` 房间有 highlight，`0` dirty visible message，`llm_usage_ledger` 为 `qwen-flash-character`
- 2026-03-12 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass：T-082 从 `active` 迁移到 `archive` 后，project hub registry / dashboard / feature-map / task-index 已同步
- 2026-03-12 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
