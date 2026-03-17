# Pull Request: UI 开发准备基础设施 (T-907)

## Summary

基于 `fun_forumai_ui_preparation.md` 完成 UI 开发准备任务包（T-907）的基础设施交付：统一 UI 真源（navy+orange、data-theme）、模块化脚本、4 个设计系统包、10 个模式组件与 AppShell、CI 门禁及治理规则。为后续 pilot 页面迁移与 uix* 移除打好基础。

## Changes

### 阶段 0 — 冻结与审计
- **dev-docs/active/ui-preparation-foundation/** 任务包
  - `artifacts/phase-0-drift-inventory.md`：token/theme/contract/codegen/Web/Mobile 漂移清单
  - `artifacts/phase-0-pilot-selection.md`：列表/详情/表单 pilot 页面选定（AgentDirectoryPage、AgentProfilePage、AgentManagePage）
  - `artifacts/phase-0-freeze-rules.md`：禁止新增视觉常量与 uix* key 的冻结规则

### 阶段 1 — 收口 UI 真源与主题
- **scripts/ui/** 新增 12 个 ESM 脚本（单一职责、index.mjs 仅编排）
  - 校验：`validate-token-schema.mjs`、`validate-theme-schema.mjs`、`validate-contract-schema.mjs`
  - 构建：`build-tokens-css.mjs`（navy+orange）、`build-web-theme.mjs`、`build-mobile-theme.mjs`、`build-contract-types.mjs`、`build-contract-manifest.mjs`
  - 检查：`check-contract-codegen-drift.mjs`、`check-theme-protocol.mjs`、`check-generated-clean.mjs`
- **package.json** 新增 npm scripts：`ui:build`、`ui:check`、`ui:validate`、`ui:tokens:build`、`ui:theme:web`、`ui:theme:mobile`、`ui:contract:build`、`ui:contract:check`、`ui:drift:check`
- **ui/styles/tokens.css**：由脚本从 `ui/tokens` 生成，统一为 navy+orange，`:root[data-theme="default.dark"]` 主题覆盖
- **ui/styles/ui.css**：统一样式入口，引用 tokens.css
- **ui/codegen/**：`contract-types.ts`（37 roles + 完整 slots）、`contract-manifest.json`、`web-theme.ts`、`mobile-theme.ts`
- **ui/spec-version.json**：版本与说明更新

### 阶段 2 — 拆出设计系统包
- **pnpm-workspace.yaml**：增加 `packages/*`
- **packages/design-tokens**：`@fun-forum/design-tokens`，导出 token 与 theme 类型/常量
- **packages/ui-contract**：`@fun-forum/ui-contract`，导出 contract 类型与 manifest
- **packages/ui-web**：`@fun-forum/ui-web`，dataUi/dataSlot 工具、theme、patterns、shell 导出
- **packages/ui-mobile**：`@fun-forum/ui-mobile`，mobile theme 与 contract 类型
- **eslint.config.js**：import boundary 规则（packages 单向依赖、shared 不依赖 features）、uix* 迁移警告（warn）

### 阶段 3 — 模式组件与 AppShell
- **packages/ui-web/src/patterns/**：10 个模式组件
  - PageScaffold、PageHeader、FilterToolbar、ListPageLayout、DetailPageLayout、FormPageLayout、FormField、EmptyState、StatusBadge、InlineAlert
- **packages/ui-web/src/shell/**：AppShell、TopBar（区域与 slot，业务以 widget 注入）
- 所有组件使用 `data-ui` / `data-slot`，符合 contract 与 7.3 props 原则

### 阶段 4 — 试点迁移准备
- **artifacts/phase-4-pilot-migration-example.md**：AgentDirectoryPage 从 uix 迁移到模式组件的示例与检查清单
- 全仓 `pnpm typecheck` 通过

### 阶段 5 — 治理强化
- **.github/workflows/ci.yml**：check job 增加步骤
  - `pnpm ui:build`
  - `pnpm ui:check`
- **eslint.config.js**：对 `src/frontend/**` 增加 uix/uix-shell/uix-primitives 的 no-restricted-imports（warn）

### 项目治理
- **.ai/project/main/**：T-907 登记为 in-progress，registry、dashboard、feature-map、task-index 已同步
- **dev-docs/active/ui-preparation-foundation/**：00-overview、01-plan、02-architecture、03-implementation-notes、04-verification（含 UI gate 说明）、05-pitfalls、roadmap、.ai-task.yaml

## Related Issues

- Task: T-907 ui-preparation-foundation
- 方案依据: 仓库根 `fun_forumai_ui_preparation.md` 与已对齐五项决策

## Testing

- [x] `pnpm ui:build` 通过
- [x] `pnpm ui:check` 通过
- [x] `pnpm typecheck` 通过
- [x] `pnpm lint` 通过（0 errors；98 warnings 为既有 uix* 迁移提示，预期）
- [ ] Pilot 页面实际迁移与视觉回归（后续 PR）

## Checklist

- [x] 代码符合项目约定（ESM、pnpm、CONTRACT 状态值）
- [x] 自检完成
- [x] 任务包与验收记录已更新（04-verification、03-implementation-notes）
- [x] 未提交敏感信息

## 后续待办（不阻塞本 PR）

- Pilot 页面（AgentDirectoryPage / AgentProfilePage / AgentManagePage）迁移到模式组件
- 视觉回归测试建立
- uix* 全量迁移后移除
- bundle budget 基线
- 可选：CI 中接入 UI Governance Gate（Python `ui_gate.py`）
