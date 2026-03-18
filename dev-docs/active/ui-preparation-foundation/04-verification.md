# 04 Verification — ui-preparation-foundation

（每次运行检查后在此记录：命令、结果、时间。）

---

## UI Gate 情况总览

项目中存在两类 UI 门禁，分工如下：

| 门禁 | 实现 | 当前 CI | 作用 |
|------|------|---------|------|
| **UI 构建与一致性** | Node：`pnpm ui:build` + `pnpm ui:check` | ✅ 已接入 | token/theme 生成、contract↔codegen 漂移、主题协议 |
| **UI Governance Gate** | Python：`ui_gate.py run --mode full` | ❌ 未接入 | data-ui contract 合规、Tailwind B1、inline style/硬编码颜色、evidence 产出 |

### 1. 已接入 CI 的 UI 门禁（Node）

- **步骤**：`.github/workflows/ci.yml` → job `check` 内：
  - `pnpm ui:build` — 校验 token/theme/contract schema，生成 tokens.css、contract-types、web-theme、mobile-theme，并构建 UI package `dist/`
  - `pnpm ui:check` — 检查 contract 与 codegen 一致、主题协议（data-theme）
- **不依赖**：仅 Node，无 Python。
- **状态**：已落地，每次 PR/push 都会跑。

### 2. UI Governance Gate（Python，未入 CI）

- **命令**：`python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
- **策略**：Tailwind B1-layout-only、theme token-only、data-ui 合规；可编排 ESLint/Stylelint/Playwright。
- **产出**：`.ai/.tmp/ui/<run-id>/` 下 `ui-gate-report.md`、`ui-gate-report.json` 等。
- **集中测试**：`node .ai/tests/run.mjs --suite ui` 会跑 ui-governance-gate（依赖 Python 3.9+）。
- **当前**：CI 未执行该 Python 脚本；需在 runner 上安装 Python 方可接入。

### 3. 建议

- **短期**：本地或 MR 前手动跑 `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`，或 `node .ai/tests/run.mjs --suite ui`，将结果记入本文件下表。
- **中期**：若需在 CI 中强制 B1 + data-ui 合规，可在 `ci.yml` 增加一步（Setup Python + 上述命令）；注意 repo 历史上有大量既有违规，可先用 `--fail-on errors` 或仅产出报告不阻塞。

---

## 验证记录

| 阶段 | 命令 / 检查项 | 结果 | 备注 |
|------|----------------|------|------|
| 阶段 1+ | `pnpm ui:build` | pass | 2026-03-18 复核通过；现同时生成并编译 UI package `dist/`，不再生成无消费者的 contract-manifest JSON |
| 阶段 1+ | `pnpm ui:check` | pass | 2026-03-18 复核通过；现包含 package-local artifacts、package/mobile typecheck、runtime import consumption 校验 |
| 阶段 2+ | `pnpm typecheck` | pass | 2026-03-18 复核通过；root app 通过真实 workspace package 解析完成类型检查 |
| PR #15 收口 | `pnpm build` | pass | 2026-03-18 通过；Vite/Tailwind 经 workspace package exports 成功解析 `@fun-forum/ui-web/styles` |
| PR #15 收口 | `pnpm lint` | pass-with-warnings | 2026-03-18；0 error / 99 warning，其中 98 个为既有 `uix*` 迁移库存，1 个为 mobile Fast Refresh warning |
| 命名/配置收口 | `pnpm ui:build` | pass | 2026-03-18；验证 `packages/tsconfig.base.json` 收口后，4 个 UI packages 仍可成功生成 `dist/` |
| 命名/配置收口 | `pnpm typecheck` | pass | 2026-03-18；后端文案模块重命名与共用 helper 抽取后，root 工程仍可通过类型检查 |
| 命名/配置收口 | `pnpm exec vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/review-service.test.ts` | pass | 2026-03-18；2 个测试文件、16 个测试全部通过，覆盖投诉/申诉通知与 linked request 同步链路 |
| 命名/配置收口 | `pnpm lint` | pass-with-warnings | 2026-03-18；0 error / 99 warning，warning 结构未变，未引入新的 lint error |
| warning 清理第一批 | `pnpm exec eslint src/frontend/app/route-components.tsx src/frontend/shared/components/LoadMore.tsx src/frontend/shared/components/OnboardingBar.tsx src/frontend/shared/components/DevAuthToolbar.tsx src/frontend/shared/components/LeftSidebar.tsx src/frontend/shared/components/RightSidebar.tsx src/frontend/shared/components/AgentPanel.tsx src/frontend/shared/components/Layout.tsx apps/mobile/src/auth/auth-context.tsx apps/mobile/src/auth/auth-state.ts apps/mobile/src/auth/use-auth.ts apps/mobile/src/navigation/auth-screen.tsx apps/mobile/src/navigation/agents-stack.tsx apps/mobile/src/navigation/main-tabs.tsx apps/mobile/src/navigation/growth-stack.tsx apps/mobile/src/navigation/private-stack.tsx` | pass | 2026-03-18；本轮修改文件局部 ESLint 通过，无新增 warning/error |
| warning 清理第一批 | `pnpm typecheck` | pass | 2026-03-18；`uix-shell` 清理与 mobile auth hook 拆分后，root 工程类型检查仍通过 |
| warning 清理第一批 | `pnpm lint` | pass-with-warnings | 2026-03-18；0 error / 90 warning，`uix-shell` 与 mobile Fast Refresh warning 已全部清零，剩余仅 `uix` / `uix-primitives` 存量 |
| warning 清理第二批 | `pnpm exec eslint src/frontend/components/ui src/frontend/features/auth src/frontend/features/guidance src/frontend/features/help src/frontend/shared/components/RichTextLite.tsx` | pass | 2026-03-18；基础组件、auth、guidance/help 的局部替换通过 ESLint，warning 基线从 90 继续降到 60 |
| warning 清理收口 | `pnpm lint` | pass | 2026-03-18；0 error / 0 warning，legacy `uix` / `uix-shell` / `uix-primitives` warning 全部清零 |
| warning 清理收口 | `pnpm typecheck` | pass | 2026-03-18；删除 `src/frontend/shared/utils/uix*.ts` 后，`pnpm typecheck` 仍通过，说明 legacy helper 已无消费者 |
| warning 清理收口 | `pnpm build` | pass | 2026-03-18；串行执行通过。注意不要与 `pnpm typecheck` 并行跑，因为两者都会触发 `ui:build`，会争用 package dist 构建链路 |
| — | `node .ai/tests/run.mjs --suite ui`（含 ui-governance-gate） | 未在本轮执行 | 依赖 Python；可选本地/CI 补充 |
