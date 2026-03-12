# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass |
| `pnpm exec prisma validate` | pass |
| `pnpm exec tsc -p tsconfig.app.json` | pass |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm vitest run src/frontend/features/forum/components/__tests__/CommentList.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx` | pass |
| `pnpm vitest run src/frontend/shared/components/__tests__/Layout.test.tsx` | pass |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` | pass |

## Governance checklist
- [x] 五个任务束目录存在。
- [x] 五个 `.ai-task.yaml` 合法且 task id 不冲突。
- [x] registry 中 `M-010 / F-050 / R-050~R-053 / T-087~T-091` 映射已补齐。
- [x] schema / migration 证据目录已建立。
- [x] code implementation 验证记录已补充。

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | pass-with-warning | `dtrace-provider` 拉 Node headers 时 `ECONNRESET`，但安装最终成功 |
| `pnpm db:validate` | pass | Prisma schema valid |
| `pnpm test src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/identity-gate-service.test.ts src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 49 tests passed |
| `pnpm test src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` | pass | 10 tests passed |
| `pnpm typecheck` | pass | includes `prisma generate` pre-step |
| `pnpm test src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/routes/__tests__/admin-api-utils.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-control-plane.test.ts` | pass | 95 tests passed after fixing review findings |
| `pnpm vitest run src/backend/services/__tests__/agent-config-lint-service.test.ts src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/routes/__tests__/private-channel-message-auth.test.ts src/backend/routes/__tests__/private-channel-memory-auth.test.ts` | pass | 48 tests passed, 覆盖 config diff lint、>200 report dedupe、forum/chat target rebind、私聊读取 owner auth |
| `pnpm exec tsc --noEmit` | pass | 新增治理仓储接口与调用点通过静态编译 |
| `pnpm exec prisma validate` | pass | `T-089` typed complaint/appeal schema 扩展后 Prisma schema 仍有效 |
| `pnpm exec prisma generate` | pass | Prisma Client 已同步生成 typed complaint/appeal 字段 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | 新增 `ensureCase()` reuse/reopen/action-log 直接单测 |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass | typed complaint/appeal、privacy request attachments、linked complaint 校验回归通过 |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | 覆盖 admin moderation queue filter、task claim、resolution metadata |
| `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | `/v1/reports` legacy façade 与 `/v1/appeals` typed 契约回归通过 |
| `pnpm vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` | pass | 帖子页举报/申诉入口在 typed payload 下仍正常 |
| `pnpm exec prisma format` | pass | `T-089` 第三段 structured evidence schema 字段已格式化回 Prisma SSOT |
| `pnpm vitest run src/backend/services/__tests__/policy-gateway-service.test.ts` | pass | 自动 moderation case 结构化 `policy_evidence` contract 回归通过 |
| `pnpm exec tsc --noEmit` | pass | `T-089` 第四段 admin transfer/export/types/tabs 改动后静态编译通过 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | 覆盖 transferCase、linked request case detail 与 evidence export |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | 覆盖 linked complaint panel、transfer route、evidence export route |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass | complaint typed workflow 在 admin operator surface 扩展后回归通过 |
| `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 公共 read API 和 `/v1/reports`、`/v1/appeals` façade 回归通过 |
| `git diff --check` | pass | no whitespace / merge-marker issues |
| `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass | refreshed `docs/context/db/schema.json` after schema change |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass | `T-089` full-foundation rebaseline 后重生成 governance views |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass | `R-051~R-053` 与 active child bundles 状态一致 |
| `git diff --check` | pass | doc/governance patch 无 whitespace / merge-marker 问题 |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass | 补写 changelog 与 verification 记录后再次确认母包治理状态一致 |
| `git diff --check` | pass | 终态校验：最终文档补丁仍无 whitespace / merge-marker 问题 |
| `pnpm exec tsc --noEmit` | pass | shared governance notification wiring 与 Safety Center timeline 改动后 frontend/backend 仍通过静态编译 |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass | complaint/appeal 创建 GOVERNANCE 通知回归通过 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | linked complaint/appeal resolve/reopen 状态同步与通知断言通过 |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | admin resolve 后用户 `/v1/reports` 与 `/v1/me/notifications` 可见结果 |
| `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | public read façade 在 notification wiring 后回归通过 |
| `pnpm vitest run src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx` | pass | Safety Center timeline 与 mark-all-read 用户面回归通过 |
| `pnpm vitest run src/frontend/features/forum/components/__tests__/CommentList.test.tsx` | pass | 评论区举报入口与 Safety Center 回执文案回归通过 |
| `pnpm vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx` | pass | 聊天室举报入口与 room page 关键交互回归通过 |
| `pnpm vitest run src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx` | pass | 主动私信 banner 举报入口与 private-session complaint payload 回归通过 |
| `pnpm vitest run src/frontend/shared/components/__tests__/Layout.test.tsx` | pass | AGENT_PROACTIVE bell item 举报动作不会误触导航 |
| `pnpm exec tsc --noEmit` | pass | comment/chat/private/proactive 举报入口与 richer Safety Center workflow copy 改动后静态编译通过 |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass | comment/chat/private/proactive GOVERNANCE 通知正文断言通过 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | resolve/reopen 通知正文带目标对象与重开原因的断言通过 |
| `pnpm vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass | admin 收尾 slice：queue playbook、release action 与 export redaction UI 回归通过 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | releaseCase、share-safe export、admin release/export 路径收尾回归通过 |
| `pnpm exec tsc --noEmit` | pass | admin release/redacted export 收尾改动与新增前端测试均通过静态编译 |
| `pnpm exec tsc --noEmit` | pass | T-089 review hardening：lifecycle/claim/redaction 修补后静态编译仍通过 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | 覆盖 claim stealing、closed-case assign/resolve、防重复 reopen 与 share export redaction |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | duplicate claim、resolved case assign、duplicate reopen 的 route-level 400 回归通过 |
| `pnpm vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass | admin UI 状态保护收紧后仍通过 operator surface 回归 |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` | fail-known-existing | report at `.ai/.tmp/ui/20260312T134832Z-23896/ui-gate-report.md`; 111 条 Tailwind B1 违规覆盖 repo 既有 UI debt 与本轮触达页面，本 slice 未统一清债 |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass | `T-089` closeout 后已刷新 child task `.ai-task.yaml` 与母包 project views |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass | `R-051/T-089` done 状态与母包文档、registry、derived views 一致 |
| `git diff --check` | pass | 收尾后的治理/文档补丁无 whitespace / merge-marker 问题 |

## DB apply status
- Repo changed: yes
- Migration files created:
  - `prisma/migrations/20260312123000_t087_mainland_launch_safety_governance/migration.sql`
  - `prisma/migrations/20260312173000_t089_typed_complaint_appeal_foundation/migration.sql`
- Migration applied to a real DB: no
- Reason: 本轮只实现 repo / schema / migration 文件与本地静态验证，未执行任何对真实数据库的写入操作。
