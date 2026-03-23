# 04 Verification

## Governance

- Completed: `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: `[ok] Sync complete.`
- Completed: `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: `[ok] Lint passed.`

## Target Verification Matrix

- Completed: `rg -n "CommentList|commentThreadContext|useCommentThreadContext|SearchCommentItem|commentSearchDoc|forum_comment|parent_comment_id|commentId=|/comments/:|\\bComment\\b|target_type: 'comment'|case 'comment'|comment_id|commentId|agent-reply-to-comment|comment_report|stage_entry|StageEntry|stageEntry|PublicStageEntry|agent-reply-to-stage-entry|comment_count|commentCount|forum:stage-drift:check|check-forum-stage-semantics-drift" src prisma/schema.prisma docs/context .ai/llm-config package.json --glob '!**/__tests__/**' --glob '!**/archive/**' --glob '!**/migrations/**'`
  - Result: exit code `1`，无命中；公开 API/UI/search/runtime/registry/context/package script 主链已不再依赖 comment-tree 或 `stage_entry` 过渡语义。
- Completed: `pnpm exec tsc --noEmit -p tsconfig.json --pretty false`
  - Result: exit code `0`。
- Completed: `pnpm lint`
  - Result: exit code `0`。
- Completed: `pnpm prisma format`
  - Result: Prisma schema formatted。
- Completed: `pnpm prisma validate`
  - Result: `The schema at prisma/schema.prisma is valid`
- Completed: `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - Result: `docs/context/db/schema.json` 已刷新，无旧 `Comment/commentId` 或 `stage_entry/comment_count` 合同残留。
- Completed: `pnpm vitest run src/backend/services/__tests__/director-history-shared.test.ts`
  - Result: `1` 个 test file、`4` 个 tests 全通过。
- Completed: `ForumSceneMetadata`、scene carrier、runtime/search/governance/shared DTO 已完成 `stage_entry` / `THREAD` / `TURN` 收敛，不再保留 comment target 查询与字段。
- Completed: `pnpm vitest run src/backend/llm/__tests__/registry-contract.test.ts src/backend/routes/__tests__/dev-prompts-render.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts src/backend/repos/__tests__/public-scene-write-repository.test.ts src/backend/runtime/__tests__/event-bridge.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/services/__tests__/governance-adapter.test.ts src/backend/services/__tests__/agent-community-membership-service.test.ts src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/relation-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/services/__tests__/public-observation-digest-service.test.ts src/backend/services/__tests__/public-observation-real-smoke.test.ts src/backend/services/__tests__/hot-topic-policy-config.test.ts src/backend/services/__tests__/hot-topic-policy-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/widgets/shell/__tests__/ShellRightRail.test.tsx src/frontend/widgets/shell/__tests__/ShellTopBarContainer.test.tsx`
  - Result: `23` 个 test files、`181` 个 tests 全通过；覆盖 forum write/read、scene write、event bridge、search projection、governance、policy、public observation 与 forum/search frontend 主链。
- Completed: 删除 `scripts/check-forum-stage-semantics-drift.mjs` 与 `package.json` 中的 `forum:stage-drift:check`
  - Result: 过渡 drift script 已随最终收敛一并移除，repo 只剩 thread/turn 单入口与常规验证链路。
