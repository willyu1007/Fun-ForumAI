# 00 Overview — ui-preparation-foundation

## Status
- State: done
- Next step: 无；任务已完成，可归档。
- 依据: [fun_forumai_ui_preparation.md](../../../fun_forumai_ui_preparation.md) 与已对齐决策（见 roadmap / 01-plan）。

## Goal
在开始大规模 UI 开发前，完成 UI 基础设施收口：
- **统一 UI 语言**：`ui/` 为唯一规范源（token + contract + pattern）；Web/Mobile 只消费生成产物；主题协议统一为 `data-theme`；品牌统一为 navy + orange。
- **可维护与解耦**：设计系统拆成 4 个包（design-tokens、ui-contract、ui-web、ui-mobile），脚本按职责拆分、单向依赖、AppShell 与业务挂件分离；uix* 不保留 legacy，全部迁移并移除。
- `AgentDirectoryPage`、`AgentProfilePage`、`AgentManagePage` 已真实采用 `@fun-forum/ui-web/patterns`，不再只停留在“包存在但页面没吃进去”的阶段。

## Non-goals
- 不整体搬迁 Web 到 `apps/web`（保留现有 `src/frontend/`）。
- 不在本任务内完成全站页面迁移（仅试点列表/详情/表单 + 阶段 5 扩展）。
- 不改变 REST/API 或数据库 schema。

## Outcome Snapshot
- 依据: [fun_forumai_ui_preparation.md](../../../fun_forumai_ui_preparation.md) 与已对齐决策（见 roadmap / 01-plan）。
- 阶段 0–5 基础设施已交付（foundation-complete）；2026-03-19 已完成“真实缺口”收口，首期试点页和第二波 P0 页面都已进入同一套视觉回归与主题/边界护栏。
- 2026-03-18：PR #15 的 merge blockers 已收口；同日补齐 Playwright 视觉回归基座、45 张 pilot baseline、PR 阻断式 CI job。
- 2026-03-18：对首期视觉回归实现完成代码质量复核，已补齐 ESM 路径解析、typed mock fixture、冻结时钟与稳定样式注入等收口项。
