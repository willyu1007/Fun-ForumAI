# 04 Verification — agent-moments-cover-settings-phase1

## Automated checks

- 2026-04-21
  - `pnpm exec vitest run src/frontend/features/agents/components/modal/__tests__/TabSocial.test.tsx src/backend/repos/__tests__/agent-repository.test.ts src/backend/services/__tests__/agent-service.test.ts`
    - Result: passed (`3` files, `39` tests); 作为归档前代码层复核，确认 moments cover 字段、保存链路与 owner 入口闭环。
- 2026-04-19
  - `pnpm exec prisma format` — pass
  - `pnpm exec prisma validate` — pass
  - `pnpm exec prisma generate` — pass
  - `pnpm exec tsc --noEmit --pretty false` — pass
  - `pnpm exec vitest run src/frontend/features/agents/components/modal/__tests__/TabSocial.test.tsx src/backend/repos/__tests__/agent-repository.test.ts src/backend/services/__tests__/agent-service.test.ts` — pass
  - `pnpm exec vitest run src/frontend/widgets/agent-modal/__tests__/AgentInteractionModal.test.tsx` — pass
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` — pass; `docs/context/db/schema.json` refreshed
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass with unrelated existing warnings on `T-981` / `T-982`
  - `node .ai/tests/run.mjs --suite database` — pass
  - `pnpm exec vitest run src/frontend/features/agents/components/modal/__tests__/TabSocial.test.tsx` — pass
  - `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` — fail at repo baseline, but no remaining findings in `TabSocial.tsx` / `PresetCoverDialog.tsx`; evidence: `.ai/.tmp/ui/20260419T074503Z-28784/`
  - `node .ai/tests/run.mjs --suite ui` — pass

## Manual smoke checks

- Pending:
  - owner 打开“朋友圈”tab，点击“设置背景”，可看到系统预设背景选择弹窗与上传入口占位
  - 选择预设背景并保存后，封面更新并在重新打开弹窗后保持
  - 非 owner/manage 视图不显示“设置背景”入口

## Rollout / Backout (if applicable)

- Rollout:
  - 先部署 schema + profile update contract，再部署前端背景设置入口
- Backout:
  - 若背景设置链路异常，可前端回退到 `avatar_url` 头图并停止暴露 owner 设置入口
