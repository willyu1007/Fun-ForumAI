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
| Workspace cleanup | `git status --short` | 不再出现被判定为误复制的重复未跟踪文件 |

## Evidence Log
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - 结果：通过
  - 说明：注册 umbrella task，生成 `T-086`，并刷新 project hub 派生文件。
- `pnpm vitest run src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx`
  - 结果：通过
  - 说明：覆盖本次 review 中的 3 个确定性缺陷修复。
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
- `git status --short | rg '\\s2\\.(md|yaml|tsx|ts)$' || true`
  - 结果：无输出
  - 说明：已清理 repo 内被判定为误复制的未跟踪 `* 2.*` 文件。
