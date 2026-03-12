# 04 Verification — public-web-chinese-first-content-presentation

## Verification Matrix

| Area | Command / Method | Result | Notes |
| --- | --- | --- | --- |
| Project governance | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | PASS | 分配任务号 `T-084`，并更新 `.ai/project/main/*` 派生视图 |
| Project governance | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | PASS | 当前 project governance 无阻断错误；历史幽灵编号已在后续治理任务中清理 |
| UI contract | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full --run-id 20260312-111144` | FAIL (repo baseline) | 证据目录 `.ai/.tmp/ui/20260312-111144/`；报告显示 3086 errors / 82 warnings，主要是既有 Tailwind B1 与 contract-slot 基线问题 |
| Type safety | `pnpm typecheck` | PASS | Prisma generate + `tsc -b` 通过 |
| Frontend + backend targeted tests | 目标 Vitest 子集 | PASS | 9 files / 45 tests 全通过 |
| LLM registry sanity | `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs` | FAIL (repo baseline) | 现有 profile 漂移：`profiles.qwen-social-public-observation-base uses visible line qwen-social-v1 but visibility is hidden` |
| Manual smoke | 代码走查 + seed / view-model 检查 | PASS (code-level) | 社区/房间标题与简介成为第一视觉层；Aftershow 改为结构化摘要；消息与评论支持分段显示 |

## Evidence Log
- `2026-03-12` `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - 结果：通过
  - 关键输出：为本任务包分配 `T-084`
- `2026-03-12` `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - 结果：通过
  - 备注：该次执行时曾观察到历史幽灵编号；后续已在 `T-086` 中清理，真实相关任务为 `T-053 event-contract-routing-baseline`
- `2026-03-12` `pnpm exec vitest run src/frontend/shared/utils/__tests__/rich-text-lite.test.ts src/frontend/features/forum/components/__tests__/CommentList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/shared/components/__tests__/Layout.test.tsx src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/backend/llm/__tests__/prompt-engine.test.ts src/backend/runtime/__tests__/persona-observation.test.ts src/backend/services/__tests__/conversation-clock.test.ts`
  - 结果：通过
  - 统计：`9` 个测试文件，`45` 个测试全部通过
- `2026-03-12` `pnpm typecheck`
  - 结果：通过
  - 修复说明：过程中修复了 `public-ui-glossary.ts` 的 TS 窄化问题
- `2026-03-12` `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - 结果：失败
  - 原因：repo 现有 profile `qwen-social-public-observation-base` 引用了 visibility 为 hidden 的 `qwen-social-v1`
- `2026-03-12` `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full --run-id 20260312-111144`
  - 结果：失败
  - 原因：repo 级 UI 基线已有大量 Tailwind B1 / contract-slot / feature-css-visual 违规，本任务未尝试在此任务内整体修复
  - 证据：
    - `.ai/.tmp/ui/20260312-111144/ui-gate-report.md`
    - `.ai/.tmp/ui/20260312-111144/ui-gate-report.json`
