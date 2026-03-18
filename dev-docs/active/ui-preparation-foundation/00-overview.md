# 00 Overview — ui-preparation-foundation

## Status

- State: in-progress
- 依据: [fun_forumai_ui_preparation.md](../../../fun_forumai_ui_preparation.md) 与已对齐决策（见 roadmap / 01-plan）。
- 阶段 0–5 基础设施已交付（foundation-complete）；首期页面视觉回归已落地 3 个试点页，剩余第二波 P0 待补。
- 2026-03-18：PR #15 的 merge blockers 已收口；同日补齐 Playwright 视觉回归基座、45 张 pilot baseline、PR 阻断式 CI job。
- 2026-03-18：对首期视觉回归实现完成代码质量复核，已补齐 ESM 路径解析、typed mock fixture、冻结时钟与稳定样式注入等收口项。

### 已完成阶段

| 阶段 | 状态 | 产出 |
|------|------|------|
| 0 冻结与审计 | ✅ | `artifacts/phase-0-*.md`（漂移清单、pilot 名单、冻结规则） |
| 1 收口真源与主题 | ✅ | `scripts/ui/*`（12 个脚本）、`ui:*` npm scripts、navy+orange tokens.css |
| 2 拆出 4 包 | ✅ | `packages/design-tokens|ui-contract|ui-web|ui-mobile`、import boundary lint |
| 3 模式组件与 AppShell | ✅ | 10 个 pattern 组件、AppShell/TopBar、`@fun-forum/ui-web` 导出 |
| 4 试点迁移准备 | ✅ | `artifacts/phase-4-pilot-migration-example.md`、typecheck 通过 |
| 4 首期视觉回归 | ✅ | `playwright.config.mjs`、`tests/web/playwright/`、3 个试点页 45 张 baseline、`web-playwright` CI job |
| 5 治理强化 | ✅ | CI 门禁（ui:build/check）、uix* 迁移 lint 规则 |

### 待执行事项

- 第二波 P0 页面视觉回归（`/rooms*`、`/agents/:agentId/chat`、`/admin`、`/agents/:agentId/dashboard`、`/`、`/posts/*` 等）
- `default.dark` 主题补充基线
- bundle budget 基线建立
- Playwright baseline 的 Linux CI 字体一致性长期复核

## Goal

在开始大规模 UI 开发前，完成 UI 基础设施收口：

1. **统一 UI 语言**：`ui/` 为唯一规范源（token + contract + pattern）；Web/Mobile 只消费生成产物；主题协议统一为 `data-theme`；品牌统一为 navy + orange。
2. **可维护与解耦**：设计系统拆成 4 个包（design-tokens、ui-contract、ui-web、ui-mobile），脚本按职责拆分、单向依赖、AppShell 与业务挂件分离；uix* 不保留 legacy，全部迁移并移除。

补充说明：

- `AgentDirectoryPage`、`AgentProfilePage`、`AgentManagePage` 当前实现已不再直接依赖 `uix*`，首期工作重点已转为“稳定截图基线 + 作为后续页面模板”。

完成定义以文档十一 11.1–11.6 验收标准为准。

## Non-goals

- 不整体搬迁 Web 到 `apps/web`（保留现有 `src/frontend/`）。
- 不在本任务内完成全站页面迁移（仅试点列表/详情/表单 + 阶段 5 扩展）。
- 不改变 REST/API 或数据库 schema。

## Accepted Decisions

| # | 决策项 | 结论 |
|---|--------|------|
| 1 | 品牌/主题 | navy + orange；所有产物对齐 |
| 2 | Dark mode | `data-theme="default.light"` / `data-theme="default.dark"` 为唯一长期协议 |
| 3 | 包拆分 | 本轮完成 4 包，顺序：design-tokens → ui-contract → ui-web → ui-mobile |
| 4 | uix* | 不保留 legacy；全部迁移至 contract/pattern 并移除 |
| 5 | 模式组件 | 按文档清单 10 个全部实现 |

## Cross-links

- 方案与文档覆盖检查见 Cursor 计划：`ui_开发准备思路对齐`。
- 规范源文档：仓库根 `fun_forumai_ui_preparation.md`。
