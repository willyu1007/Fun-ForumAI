# 04 Verification — repo-baseline-governance-and-ui-remediation

## Verification Matrix

| Area | Command / Method | Expected |
| --- | --- | --- |
| Project governance | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | umbrella task 注册成功 |
| Project governance | `node .ai/scripts/ctl-project-governance.mjs lint --strict --project main` | 无 error / warning |
| LLM registry | `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs` | 通过 |
| UI gate | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` | `0 errors / 0 warnings` |
| UI suite | `node .ai/tests/run.mjs --suite ui` | 通过 |
| Type safety | `pnpm typecheck` | 通过 |
| Targeted tests | 相关 Vitest 子集 | 功能修复与回归通过 |
| Live seed | `node scripts/seed-data.mjs --base-url http://127.0.0.1:4000` | 真实库返回非零社区 / agent / 帖子 / 评论 / 房间数 |
| Live chat formatting | 房间控制 API + `qwen-flash` 实聊 | 生成内容满足中文短句、分行、首行先给判断 |
| Concurrent cues | 并发 `POST /v1/rooms/:roomId/program/cues` | 持续 `201`，不出现 ordinal 冲突 500 |
| PPR startup | 后端启动日志 | `PprRefreshScheduler` startup refresh 完成，无 `P2002` |
| Workspace cleanup | `git status --short` | 不再出现被判定为误复制的重复未跟踪文件 |

## Evidence Log
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - 结果：通过
  - 说明：注册 umbrella task，生成 `T-086`，并刷新 project hub 派生文件。
- `pnpm vitest run src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx`
  - 结果：通过
  - 说明：覆盖本次 review 中的 3 个确定性缺陷修复。
- `pnpm vitest run src/backend/repos/__tests__/ppr-snapshot-repository.test.ts src/backend/repos/__tests__/pg-room-watchability-repository.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/chatroom-control-api.test.ts src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/services/__tests__/chatroom-runtime-context-builder.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/backend/llm/__tests__/prompt-engine.test.ts`
  - 结果：通过
  - 说明：覆盖 seed 修复、cue 并发唯一键、PPR 去重、聊天室 prompt/readability 约束和 live 消息整形链路。
- `pnpm typecheck`
  - 结果：通过
  - 说明：`pretypecheck` 的 Prisma client 生成成功，随后 `tsc -b` 正常退出。
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - 结果：通过
  - 说明：validator 输出 `OK: registries are structurally and contractually valid.`
- `node .ai/scripts/ctl-project-governance.mjs lint --strict --project main`
  - 结果：通过
  - 说明：输出 `[ok] Lint passed.`
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - 结果：通过
  - 说明：当前有效 evidence run 为 `.ai/.tmp/ui/20260312T045419Z-38209`
  - 摘要：`Errors: 0`, `Warnings: 0`, `eslint PASS`
  - 范围：仅覆盖 Web frontend（`src/frontend`）
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py approval-approve --request ...`
  - 结果：通过
  - 说明：对应 approval 文件为 `ui/approvals/20260312T040827Z-spec_change-8d8bdaea.json`
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py approval-approve --request .ai/.tmp/ui/20260312T045345Z-37136/approval.request.json --approved-by codex`
  - 结果：通过
  - 说明：为 `ui/config/governance.json` 的范围调整补齐 exception approval，文件为 `ui/approvals/20260312T045411Z-exception-2efeb801.json`
- `node .ai/tests/run.mjs --suite ui`
  - 结果：通过
  - 说明：最新 run id `20260312-045419-fc3bbf`，`ui-system-bootstrap`、`ui-governance-gate`、`ui-governance-gate-approval-order`、`ui-style-intake-from-image` 全部 PASS。
- `node scripts/seed-data.mjs --base-url http://127.0.0.1:4000`
  - 结果：通过
  - 说明：真实持久化库返回 `communities=4 agents=5 posts=5 comments=10 rooms=1`，验证 `dev-seed` 不再因陈旧 seed 数据而退化为零活跃内容。
- 房间控制 API + 实际 LLM 调用（`LLM_PROVIDER=openai-compatible`，`LLM_MODEL=qwen-flash`）
  - 结果：通过
  - 说明：真实消息样本已出现两行式输出，例如 `现在的情况比预期好。` / `接下来关注谁能真正解决问题。`，不再以单段礼貌寒暄为主。
- 并发 3 路 `POST /v1/rooms/:roomId/program/cues`
  - 结果：通过
  - 说明：多轮压测持续返回 `201 201 201`，未再复现 `(episode_id, ordinal)` 冲突。
- 后端启动日志检查
  - 结果：通过
  - 说明：修复后观察到 `[PprRefreshScheduler] ppr-refresh:startup done ...`，先前的 Prisma `P2002` 唯一键报错已消失。
- `git status --short | rg '\\s2\\.(md|yaml|tsx|ts)$' || true`
  - 结果：无输出
  - 说明：已清理 repo 内被判定为误复制的未跟踪 `* 2.*` 文件。
