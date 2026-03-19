# 04 Verification — ui-preparation-foundation

（每次运行检查后在此记录：命令、结果、时间。）

---

## UI Gate 情况总览

项目中存在两类 UI 门禁，分工如下：

| 门禁 | 实现 | 当前 CI | 作用 |
|------|------|---------|------|
| **UI 构建与一致性** | Node：`pnpm ui:build` + `pnpm ui:check` | ✅ 已接入 | token/theme 生成、contract↔codegen 漂移、主题协议 |
| **UI Governance Gate** | Python：`ui_gate.py run --mode full` | ❌ 未接入 | data-ui contract 合规、semantic token Tailwind 策略、inline style/硬编码颜色、approval/evidence 产出 |

### 1. 已接入 CI 的 UI 门禁（Node）

- **步骤**：`.github/workflows/ci.yml` → job `check` 内：
  - `pnpm ui:build` — 校验 token/theme/contract schema，生成 tokens.css、contract-types、web-theme、mobile-theme，并构建 UI package `dist/`
  - `pnpm ui:check` — 检查 contract 与 codegen 一致、主题协议（data-theme）
- **不依赖**：仅 Node，无 Python。
- **状态**：已落地，每次 PR/push 都会跑。

### 2. UI Governance Gate（Python，未入 CI）

- **命令**：`python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
- **策略**：Tailwind `semantic-token-guarded`、theme token-only、data-ui 合规；可编排 ESLint/Stylelint/Playwright。
- **产出**：`.ai/.tmp/ui/<run-id>/` 下 `ui-gate-report.md`、`ui-gate-report.json` 等。
- **集中测试**：`node .ai/tests/run.mjs --suite ui` 会跑 ui-governance-gate（依赖 Python 3.9+）。
- **当前**：CI 未执行该 Python 脚本；需在 runner 上安装 Python 方可接入。最新本地 full run `.ai/.tmp/ui/20260319T050955Z-48487/` 已为 `errors=0 / spec_status=OK / exception_status=OK / playwright=PASS`。

### 3. 建议

- **短期**：本地或 MR 前手动跑 `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`，或 `node .ai/tests/run.mjs --suite ui`，将结果记入本文件下表。
- **中期**：若需在 CI 中强制 Python gate，可在 `ci.yml` 增加一步（Setup Python + 上述命令）；当前离线基线已收口，不再需要先处理历史 Tailwind B1 backlog。

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
| 产物清理 | `find . -maxdepth 4 \\( -type d \\( -name dist -o -name coverage -o -name .vitest -o -name __snapshots__ -o -name playwright-report -o -name test-results -o -name .pytest_cache -o -name htmlcov -o -name .nyc_output \\) -o -type f \\( -name '*.log' -o -name '*.lcov' -o -name 'junit*.xml' -o -name 'coverage-final.json' -o -name '.DS_Store' \\) \\)` | pass | 2026-03-18；清理前仅发现 root 与 4 个 UI packages 的 `dist/` 目录，清理后上述扫描为空 |
| 首期视觉回归 | `pnpm install --no-frozen-lockfile --force` | pass | 2026-03-18；为解决本机 pnpm store 与历史 `node_modules` 链接不一致，执行强制重装并写入 Playwright 依赖 |
| 首期视觉回归 | `pnpm build` | pass | 2026-03-18；验证 `workspace-package-aliases.ts` 后，fresh install 场景下 root app 可再次解析 `@fun-forum/ui-web/theme` |
| 首期视觉回归 | `pnpm exec playwright test --config=playwright.config.mjs --list` | pass | 2026-03-18；识别到 3 个 spec、45 个 visual tests |
| 首期视觉回归 | `pnpm exec playwright install chromium` | pass | 2026-03-18；本地 Chromium browser 安装完成 |
| 首期视觉回归 | `pnpm test:e2e:playwright:update` | pass | 2026-03-18；生成 45 张 baseline PNG，输出 `artifacts/playwright/report` 与 `artifacts/playwright/results.json` |
| 首期视觉回归 | `pnpm test:e2e:playwright` | pass | 2026-03-18；45/45 tests 通过，截图基线稳定 |
| 代码质量复核 | `pnpm build` | pass | 2026-03-18；在 `workspace-package-aliases.ts` 切到 `import.meta.url` 解析后，fresh install / preview 构建链路仍可通过 |
| 代码质量复核 | `pnpm test:e2e:playwright` | pass | 2026-03-18；typed fixture、冻结时钟与稳定样式注入调整后，45/45 tests 再次通过 |
| 代码质量复核 | `pnpm exec eslint --no-ignore playwright.config.mjs workspace-package-aliases.ts tests/web/playwright --ext .ts,.tsx,.mjs` | pass | 2026-03-18；针对本轮新增视觉回归文件与配置文件做定向 ESLint，未发现 error/warning |
| bundle budget | `pnpm build` | pass | 2026-03-19；生成 `dist/frontend/bundle-report.json`，`index-*.js` 降到 `51.94 kB raw / 15.72 kB gzip`，不再触发 `>500 kB` warning |
| bundle budget | `pnpm ui:bundle:accept` | pass | 2026-03-19；将当前 top 10 JS chunks 固化到 `ui/config/bundle-baseline.json`，最大 JS chunk 为 `framework = 192.93 kB raw / 60.47 kB gzip` |
| bundle budget | `pnpm ui:bundle:report` | pass | 2026-03-19；可打印 top JS chunks、baseline 值与 delta，对应 `dist/frontend/bundle-report.json` |
| bundle budget | `pnpm ui:bundle:check` | pass | 2026-03-19；验证 root entry hard budget、最大 JS chunk 不回归、6 个重路由仍保有异步边界 |
| bundle budget | `pnpm ui:bundle:check -- --budget-file /tmp/fun-forum-bundle-budget-strict.json` | fail-as-expected | 2026-03-19；将 root entry raw budget 临时收紧到 `1 kB` 后，命令以非零退出并报出 `assets/index-*.js above hard limit`，证明阻断逻辑生效 |
| bundle budget | `pnpm vitest run src/frontend/shared/components/__tests__/Layout.test.tsx` | pass | 2026-03-19；根壳层改为 direct hook imports 后，相关 layout tests 仍全部通过（3/3） |
| bundle budget | `pnpm lint` | pass | 2026-03-19；新增 Vite/plugin/scripts 与 root-shell import 收口未引入新的 lint error/warning |
| bundle budget | `pnpm exec eslint --no-ignore vite.config.ts scripts/ui/*.mjs src/frontend/shared/components/AgentPanel.tsx src/frontend/shared/components/Layout.tsx src/frontend/shared/components/LeftSidebar.tsx src/frontend/shared/components/RightSidebar.tsx src/frontend/shared/components/__tests__/Layout.test.tsx --ext .ts,.tsx,.mjs` | pass | 2026-03-19；覆盖 Vite 配置与新加 bundle 脚本的定向 ESLint 通过 |
| bundle budget | `pnpm vitest run src/frontend/shared/components/__tests__/Layout.test.tsx` | pass | 2026-03-19；移除测试中多余 mock export 后再次回归，仍为 3/3 通过 |
| bundle budget follow-up | `pnpm build` | pass | 2026-03-19；review follow-up 后重新生成 `dist/frontend/bundle-report.json`，确认路径 SSOT 收口未影响实际构建产物，root entry 仍为 `51.94 kB raw / 15.72 kB gzip` |
| bundle budget follow-up | `pnpm ui:bundle:report` | pass | 2026-03-19；review follow-up 后默认链路仍可正确读取 `ui/config/bundle-budget.json` 与 `ui/config/bundle-baseline.json` |
| bundle budget follow-up | `pnpm ui:bundle:check` | pass | 2026-03-19；review follow-up 后 hard gate 与 async route 边界检查仍通过 |
| bundle budget follow-up | `pnpm ui:bundle:accept -- --budget-file /tmp/fun-forum-bundle-budget-alt.json` | pass | 2026-03-19；临时 budget 将 `baselinePath` 指向 `/tmp/fun-forum-bundle-baseline-alt.json`，命令实际写入该路径，证明基线路径默认值已从配置读取 |
| bundle budget follow-up | `pnpm ui:bundle:report -- --budget-file /tmp/fun-forum-bundle-budget-alt.json` | pass | 2026-03-19；输出显示 `Bundle report: /tmp/fun-forum-bundle-report-alt.json` 与 `Accepted baseline: /tmp/fun-forum-bundle-baseline-alt.json`，证明 report/baseline 路径都跟随配置而不是硬编码默认值 |
| bundle budget follow-up | `pnpm ui:bundle:check -- --budget-file /tmp/fun-forum-bundle-budget-alt.json` | pass | 2026-03-19；自定义 budget 场景下校验命令仍可通过，证明 CLI 默认链路已完全尊重配置文件中的路径字段 |
| bundle budget follow-up | `pnpm ui:bundle:check -- --budget-file /tmp/fun-forum-bundle-budget-no-root.json` | fail-as-expected | 2026-03-19；临时伪造无 root entry 的 report 后，错误信息明确指向 `/tmp/fun-forum-bundle-report-no-root.json`，证明失败文案也使用实际 report 路径而不是旧默认值 |
| UI gap closure | `pnpm lint` | pass | 2026-03-19；shell/widgets、pattern adopt、theme protocol 与 Playwright 扩面后的整仓 ESLint 通过 |
| UI gap closure | `pnpm typecheck` | pass | 2026-03-19；修复 `vite.config.ts` / `vitest.config.ts` 的 ESM import 与 `tsconfig.node.json` include 后，`tsc -b` 重新通过 |
| UI gap closure | `pnpm ui:build` | pass | 2026-03-19；验证 shell refactor、theme 单协议与 mobile alias freeze 不影响 UI codegen 与 package dist 生成 |
| UI gap closure | `pnpm ui:check` | pass | 2026-03-19；theme protocol、package typecheck、runtime consumption 与 generated drift 全部通过 |
| UI gap closure | `pnpm build` | pass | 2026-03-19；当前 `assets/index-*.js = 52.03 kB raw / 15.79 kB gzip`，继续满足 hard budget |
| UI gap closure | `pnpm ui:bundle:check` | pass | 2026-03-19；root entry budget、最大 chunk baseline、异步重路由边界继续通过 |
| UI gap closure | `pnpm exec vitest run src/frontend/app/shell/__tests__/AppShellContainer.test.tsx src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx` | pass | 2026-03-19；壳容器与受影响 agent profile 页面共 10 个测试全部通过 |
| UI gap closure | `pnpm mobile:typecheck` | pass | 2026-03-19；mobile app 在兼容层冻结后继续可通过 `tsc --noEmit` |
| UI gap closure | `pnpm --filter @fun-forum/mobile test -- --runInBand src/__tests__/theme.test.ts` | pass | 2026-03-19；验证 legacy alias surface 被固定，不允许继续增长 |
| UI gap closure | `printf "import { useAgentDetail } from '@/features/agents/hooks/use-agent-detail'..." \| pnpm exec eslint --stdin --stdin-filename src/frontend/shared/__lint-boundary-check.tsx` | fail-as-expected | 2026-03-19；`shared -> features` 现会被 `no-restricted-imports` 直接阻断，证明边界护栏已真实生效 |
| UI gap closure | `pnpm ui:check`（临时加入 `src/frontend/__theme-protocol-negative.ts = 'dark:bg-slate-900'`） | fail-as-expected | 2026-03-19；`check-theme-protocol.mjs` 明确报出 `contains a dark: utility`，证明 `.dark` / `dark:` 已成为阻断项 |
| UI gap closure | `pnpm exec playwright test --config=playwright.config.mjs tests/web/playwright/realtime-p0.visual.spec.ts --update-snapshots` | pass | 2026-03-19；在新增 scroll reset 与 bounded tolerance 后，`realtime` 基线重新稳定 |
| UI gap closure | `pnpm test:e2e:playwright:update` | pass | 2026-03-19；6 个 spec、168 个 visual tests 的双主题 baseline 已全部刷新，旧 3-project baseline 也已清理 |
| UI gap closure | `pnpm test:e2e:playwright` | pass | 2026-03-19；168/168 tests 通过，说明当前 Playwright 基线与稳定化策略已闭环 |
| — | `node .ai/tests/run.mjs --suite ui`（含 ui-governance-gate） | 未在本轮执行 | 依赖 Python；可选本地/CI 补充 |
| code review follow-up | `pnpm exec vitest run src/frontend/app/shell/__tests__/AppShell.test.tsx src/frontend/app/shell/__tests__/AppShellContainer.test.tsx` | pass | 2026-03-19；验证 `AppShell` 仅保留结构职责，不再与 `AppShellContainer` 重复声明 header/rail/footer 尺寸与边框 |
| code review follow-up | `pnpm lint` | pass | 2026-03-19；壳层结构收口与新增 `AppShell` 测试未引入 lint error |
| code review follow-up | `pnpm typecheck` | pass | 2026-03-19；`AppShell` 结构调整后，root 工程与 workspace packages 继续通过 `tsc -b` |
| code review follow-up | `pnpm ui:check` | pass | 2026-03-19；theme protocol、generated drift、package runtime/typecheck 在 follow-up 后继续通过 |
| code review follow-up | `pnpm ui:bundle:check` | pass | 2026-03-19；当前 top chunk 仍满足 baseline，对应 `AgentProfilePage` 仅有 `+0.47 kB raw / +0.36 kB gzip` 的非阻断波动 |
| code review follow-up | `pnpm test:e2e:playwright:update` | pass | 2026-03-19；`AppShell` 结构修正后，6 个 spec、168 张 baseline 已按预期整体刷新 |
| code review follow-up | `pnpm test:e2e:playwright` | pass | 2026-03-19；follow-up baseline 刷新后 168/168 tests 再次通过 |
| governance reassessment | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py approval-approve --request .ai/.tmp/ui/20260319T035020Z-54614/approval.request.json --approved-by codex` | pass | 2026-03-19；为本轮 UI spec 变更补齐 `ui/approvals/20260319T035557Z-spec_change-c3d5d09b.json` |
| governance reassessment | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` | fail-known-existing | 2026-03-19；最新 run `.ai/.tmp/ui/20260319T035737Z-64755/` 中 `spec_status=OK`、`playwright=PASS`、`eslint=PASS`，剩余 `3896 errors` 全部来自 repo 现存 Tailwind B1 baseline，说明 Python gate 目前仍是离线审计工具而非可阻断 merge gate |
| offline audit closure | `pnpm lint` | pass | 2026-03-19；语义色板收口、primitive contract 调整与 shell/widget 清理后，repo 级 ESLint 继续通过 |
| offline audit closure | `pnpm typecheck` | pass | 2026-03-19；串行重跑后 root `tsc -b` 通过，说明 UI contract/package 变更未引入类型回归 |
| offline audit closure | `pnpm ui:check` | pass | 2026-03-19；以串行方式重跑后通过，证明 UI package runtime/typecheck/theme protocol 均正常 |
| offline audit closure | `pnpm ui:bundle:check` | pass | 2026-03-19；最新 build 继续满足 bundle budget gate，`AgentProfilePage` 的非阻断波动仍在接受基线内 |
| offline audit closure | `pnpm mobile:typecheck` | pass | 2026-03-19；mobile app 继续通过 `tsc --noEmit`，alias freeze 未引入回归 |
| offline audit closure | `pnpm test:e2e:playwright:update` | pass | 2026-03-19；刷新 `AgentManagePage` wizard overlay、`AgentProfilePage` spectator/long-content、`realtime` dashboard 等受影响 visual baseline |
| offline audit closure | `pnpm test:e2e:playwright` | pass | 2026-03-19；直接命令复跑 168/168 tests 通过，说明刷新后的 baseline 与当前样式完全一致 |
| offline audit closure | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py approval-approve --request .ai/.tmp/ui/20260319T050638Z-35142/approval.request.json --approved-by codex` | pass | 2026-03-19；生成 `ui/approvals/20260319T050855Z-exception-98bcd766.json`，收口 governance fingerprint |
| offline audit closure | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py approval-approve --request .ai/.tmp/ui/20260319T050904Z-45405/approval.request.json --approved-by codex` | pass | 2026-03-19；生成 `ui/approvals/20260319T050950Z-spec_change-f3d1d0f0.json`，收口最新 spec fingerprint |
| offline audit closure | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py approval-status` | pass | 2026-03-19；latest spec/exception fingerprints 与 approvals 完全一致 |
| offline audit closure | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` | pass | 2026-03-19；evidence `.ai/.tmp/ui/20260319T050955Z-48487/` 中 `errors=0 / warnings=0 / spec_status=OK / exception_status=OK / playwright=PASS`，离线 UI 审计正式收口 |
