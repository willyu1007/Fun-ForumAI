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
  - `pnpm ui:build` — 校验 token/theme/contract schema，生成 tokens.css、contract-types、web-theme、mobile-theme、contract-manifest
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
| 阶段 1+ | `pnpm ui:build` | pass | 2026-03-18 复核通过；现同时生成并编译 UI package `dist/` |
| 阶段 1+ | `pnpm ui:check` | pass | 2026-03-18 复核通过；现包含 package-local artifacts、package/mobile typecheck、runtime import consumption 校验 |
| 阶段 2+ | `pnpm typecheck` | pass | 2026-03-18 复核通过；root app 通过真实 workspace package 解析完成类型检查 |
| PR #15 收口 | `pnpm build` | pass | 2026-03-18 通过；Vite/Tailwind 经 workspace package exports 成功解析 `@fun-forum/ui-web/styles` |
| PR #15 收口 | `pnpm lint` | pass-with-warnings | 2026-03-18；0 error / 99 warning，其中 98 个为既有 `uix*` 迁移库存，1 个为 mobile Fast Refresh warning |
| — | `node .ai/tests/run.mjs --suite ui`（含 ui-governance-gate） | 未在本轮执行 | 依赖 Python；可选本地/CI 补充 |
