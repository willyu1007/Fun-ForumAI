# 00 Overview — ui-preparation-foundation

## Status

- State: completed
- 依据: [fun_forumai_ui_preparation.md](../../../fun_forumai_ui_preparation.md) 与已对齐决策（见 roadmap / 01-plan）。
- 阶段 0–5 基础设施已交付（foundation-complete）；2026-03-19 已完成“真实缺口”收口，首期试点页和第二波 P0 页面都已进入同一套视觉回归与主题/边界护栏。
- 2026-03-18：PR #15 的 merge blockers 已收口；同日补齐 Playwright 视觉回归基座、45 张 pilot baseline、PR 阻断式 CI job。
- 2026-03-18：对首期视觉回归实现完成代码质量复核，已补齐 ESM 路径解析、typed mock fixture、冻结时钟与稳定样式注入等收口项。
- 2026-03-19：bundle budget/report/manualChunks/CI regression gate 已落地；`pnpm build` 现生成 `dist/frontend/bundle-report.json`，主入口从历史基线 `516.87 kB / 163.86 kB` 降到 `51.94 kB / 15.72 kB`。
- 2026-03-19：完成 `AppShellContainer + widgets` 容器化、修复 `shared -> features` 失效 lint、3 个 pilot 页面真实采用 `@fun-forum/ui-web/patterns`、`.dark` bridge 全量移除、mobile 兼容层冻结、shadcn/PR 治理规约落库。
- 2026-03-19：Playwright 扩面到全部 P0 页面与 `default.light/default.dark` 双主题，共 6 个 spec、168 个 visual tests；历史 3-project baseline 已清理，当前仓库仅保留 6-project 快照。
- 2026-03-19：离线 UI 审计已收口。`ui-governance-gate` 已切到与现状一致的 `semantic-token-guarded` 策略，最新 full run `.ai/.tmp/ui/20260319T050955Z-48487/` 为 `errors=0 / spec_status=OK / exception_status=OK / playwright=PASS`；对应 approvals 为 `ui/approvals/20260319T050855Z-exception-98bcd766.json` 与 `ui/approvals/20260319T050950Z-spec_change-f3d1d0f0.json`。
- 2026-03-19：继续收紧壳层与低优先漂移：`ShellTopBar` 改成纯 presenter、top-bar 业务装配迁到 container、`DevAuthToolbar` 移出 `shared`、无运行时消费者的 `OnboardingBar` 直接删除、`components.json` 调整为 `default + slate`、mobile 仓库内真实 caller 全部改为 `@fun-forum/ui-mobile/theme` 并加导入护栏。

### 已完成阶段

| 阶段 | 状态 | 产出 |
|------|------|------|
| 0 冻结与审计 | ✅ | `artifacts/phase-0-*.md`（漂移清单、pilot 名单、冻结规则） |
| 1 收口真源与主题 | ✅ | `scripts/ui/*`（12 个脚本）、`ui:*` npm scripts、navy+orange tokens.css |
| 2 拆出 4 包 | ✅ | `packages/design-tokens|ui-contract|ui-web|ui-mobile`、import boundary lint |
| 3 模式组件与 AppShell | ✅ | 10 个 pattern 组件、AppShell/TopBar、`@fun-forum/ui-web` 导出 |
| 4 试点迁移准备 | ✅ | `artifacts/phase-4-pilot-migration-example.md`、typecheck 通过 |
| 4 视觉回归基座 | ✅ | `playwright.config.mjs`、`tests/web/playwright/`、3 个试点页 45 张 baseline、`web-playwright` CI job |
| 5 治理强化 | ✅ | CI 门禁（ui:build/check + ui:bundle:check）、uix* 迁移 lint 规则、bundle baseline/report |
| 6 真实缺口收口 | ✅ | `AppShellContainer`、`src/frontend/widgets/shell/*`、3 个 pilot pattern adopt、168 张双主题 baseline、`data-theme` 单协议、mobile alias freeze、`.github/pull_request_template.md` |

### 长期观察

- 当前任务范围内已无阻塞待执行项。
- `src/frontend/shared/components/` 现只保留纯共享组件；不要把 auth/guidance/notification/dev widget 再放回 `shared`。
- Linux CI 字体渲染一致性继续作为长期观察项；若后续升级 Chromium 或 runner 字体包，需优先复核 `tests/web/playwright/` baseline。
- Python `ui-governance-gate` 现已通过离线 repo-baseline 审计，但它仍未接入 CI，因此现在的定位是“已通过的离线审计与 approval/evidence gate”，不是当前 workflow 里的 active merge gate。当前真正在线上阻断 PR 的仍是 `pnpm lint`、`pnpm ui:check`、`pnpm ui:bundle:check` 与 `pnpm test:e2e:playwright`。

## Goal

在开始大规模 UI 开发前，完成 UI 基础设施收口：

1. **统一 UI 语言**：`ui/` 为唯一规范源（token + contract + pattern）；Web/Mobile 只消费生成产物；主题协议统一为 `data-theme`；品牌统一为 navy + orange。
2. **可维护与解耦**：设计系统拆成 4 个包（design-tokens、ui-contract、ui-web、ui-mobile），脚本按职责拆分、单向依赖、AppShell 与业务挂件分离；uix* 不保留 legacy，全部迁移并移除。

补充说明：

- `AgentDirectoryPage`、`AgentProfilePage`、`AgentManagePage` 已真实采用 `@fun-forum/ui-web/patterns`，不再只停留在“包存在但页面没吃进去”的阶段。
- `/agents/:agentId/dashboard`、`/rooms`、`/rooms/:roomId`、`/agents/:agentId/chat`、`/`、`/c/:slug`、`/posts/:postId`、`/communities`、`/highlights`、`/safety`、`/login`、`/register`、`/admin` 已全部进入 P0 visual regression。

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
- 视觉与提交流程规约：`docs/project/ui-governance.md`、`.github/pull_request_template.md`。
