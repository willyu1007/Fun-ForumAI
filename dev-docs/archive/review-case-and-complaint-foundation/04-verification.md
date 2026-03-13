# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec prisma format` | pass |
| `pnpm exec prisma validate` | pass |
| `pnpm exec prisma generate` | pass |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass |
| `pnpm exec vitest run src/backend/services/__tests__/review-service.test.ts` | pass |
| `pnpm vitest run src/backend/services/__tests__/policy-gateway-service.test.ts` | pass |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass |
| `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts` | pass |
| `pnpm vitest run src/frontend/features/forum/components/__tests__/CommentList.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass |
| `pnpm vitest run src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx` | pass |
| `pnpm vitest run src/frontend/shared/components/__tests__/Layout.test.tsx` | pass |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` | pass |
| `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass |
| `git diff --check` | pass |

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm exec prisma format` | pass | `ModerationEvidenceSnapshot` 结构化字段与前两段 schema 改动已格式化回 SSOT |
| `pnpm exec prisma validate` | pass | `prisma/schema.prisma` 在 typed complaint/appeal + queue/claim + structured evidence 字段合并后仍有效 |
| `pnpm exec prisma generate` | pass | Prisma Client 已同步包含 complaint/appeal typed 字段与 `ModerationEvidenceSnapshot` 结构化 evidence 列 |
| `pnpm exec tsc --noEmit` | pass | backend/frontend 类型改动和 Prisma 映射无静态编译错误 |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass | 覆盖 complaint type 推断、privacy request attachments、linked complaint 校验、>200 case dedupe，以及 structured complaint evidence contract |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | 直接覆盖 `ensureCase()` 的 open-case reuse、resolved-case reopen、`claimTask()`、resolve metadata 与 structured reopen evidence |
| `pnpm vitest run src/backend/services/__tests__/policy-gateway-service.test.ts` | pass | 覆盖自动 moderation case 写入 `policy_evidence` 的 content/context/policy_hits/action_history |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | 覆盖 privacy complaint -> queue filter -> task claim -> case resolve metadata，以及 admin case detail 返回 structured evidence |
| `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 覆盖 `/v1/reports` legacy façade、`/v1/appeals` typed request/response 契约 |
| `pnpm vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` | pass | 帖子页举报/申诉入口在 typed hook 参数下仍可渲染与交互 |
| `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass | 更新 `docs/context/db/schema.json` 与 `docs/context/registry.json` 的 DB contract checksum |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass | T-089 implementation notes / verification 更新后 project hub 派生视图已重新同步 |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass | `R-051` 与 active task bundle 表述、状态、验收记录保持一致 |
| `git diff --check` | pass | 代码、schema、task bundle、context contract 补丁均无 whitespace / merge-marker 问题 |
| `pnpm exec tsc --noEmit` | pass | admin transfer/evidence export/types/tabs 改动后 frontend/backend 仍无静态类型错误 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | 新增 transferCase、linked complaint case detail 与 evidence export contract 覆盖 |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | 新增 linked complaint panel、case transfer route、evidence export route 覆盖 |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass | 回归确认 complaint typed workflow 在 detail/export 扩展后未受影响 |
| `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 回归确认 `/v1/reports`、`/v1/appeals` façade 与公共 read API 未被 admin surface 改动打断 |
| `pnpm exec tsc --noEmit` | pass | shared notification wiring、Safety Center timeline 与新前端测试文件加入后仍无静态类型错误 |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass | 新增 complaint/appeal 创建 GOVERNANCE 通知断言后仍全部通过 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | 新增 linked complaint/appeal resolve/reopen 状态同步与通知断言后通过 |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | 新增用户 `/v1/reports` 与 `/v1/me/notifications` 结案可见性断言后通过 |
| `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 回归确认 public read façade 未被 notification wiring 与 user surface 改动打断 |
| `pnpm vitest run src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx` | pass | 覆盖 Safety Center timeline 合并 reports/appeals/governance notifications 与 mark-all-read 操作 |
| `pnpm vitest run src/frontend/features/forum/components/__tests__/CommentList.test.tsx` | pass | 覆盖评论区举报入口触发 typed complaint mutation 与 Safety Center 回执文案 |
| `pnpm vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx` | pass | 覆盖聊天室发言举报入口与 room page 回归 |
| `pnpm vitest run src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx` | pass | 覆盖主动私信 banner 举报入口与 private-session complaint payload |
| `pnpm vitest run src/frontend/shared/components/__tests__/Layout.test.tsx` | pass | 覆盖 AGENT_PROACTIVE bell item 举报动作不会误触父级导航 |
| `pnpm exec tsc --noEmit` | pass | comment/chat/private/proactive 举报入口与 richer Safety Center workflow copy 改动后静态编译仍通过 |
| `pnpm vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts` | pass | 补充 comment/chat/private/proactive GOVERNANCE 通知正文断言后通过 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | resolve/reopen 通知正文带目标对象与重开原因的断言通过 |
| `pnpm vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass | 覆盖 operator 侧 queue playbook、release action 与 evidence export redaction 切换 |
| `pnpm exec tsc --noEmit` | pass | release/redacted export contract 与 AdminPanel 收尾测试加入后仍无静态类型错误 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | releaseCase、share-safe evidence export 与 admin release/export route 收尾回归通过 |
| `pnpm exec tsc --noEmit` | pass | review-driven lifecycle/claim/redaction hardening 与 AdminPanel 状态保护改动后静态类型仍通过 |
| `pnpm vitest run src/backend/services/__tests__/review-service.test.ts` | pass | 新增 claim stealing、closed-case assign/resolve、防重复 reopen 与 share export redaction 断言通过 |
| `pnpm vitest run src/backend/routes/__tests__/admin-moderation-api.test.ts` | pass | duplicate claim、resolved case assign、duplicate reopen 的 400 回归通过 |
| `pnpm vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass | admin UI 收紧后仍能展示 queue playbook、release 与 export redaction；非法 claim/reopen 状态不再走 UI happy path |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` | fail-known-existing | gate 产出 `.ai/.tmp/ui/20260312T134832Z-23896/ui-gate-report.md`，报告 111 条 Tailwind B1 违规，覆盖 repo 既有 UI debt（如 `AdminPanel` / `PostDetailPage` / `PrivateChatPage`）以及本轮触达的 user surfaces，当前未在本 slice 内统一清债 |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass | 收尾后已同步 `T-089` 完成态，刷新 `.ai-task.yaml` 与 project dashboard / feature-map / task-index |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass | `R-051/T-089` 完成态、task bundle 与 registry/changelog 已保持一致 |
| `git diff --check` | pass | 收尾文档、registry 与 governance 视图补丁均无 whitespace / merge-marker 问题 |

## Notes
- 本轮已包含产品代码、schema 与 migration 文件改动；尚未对任何真实数据库执行 `migrate deploy`。
- 新增 migration：`prisma/migrations/20260312173000_t089_typed_complaint_appeal_foundation/migration.sql`
