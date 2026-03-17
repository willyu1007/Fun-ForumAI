# 03 Implementation Notes — ui-preparation-foundation

（实施过程中按阶段追加：记录每阶段做了什么、为何、以及未决/待办。）

---

## 阶段 0: 冻结与审计 (2026-03-17)

### 0.1 冻结规则已建立

- 产出文档: `artifacts/phase-0-freeze-rules.md`
- 禁止新增视觉常量（index.css、theme.ts、硬编码颜色）
- 禁止新增 uix* key
- 新代码必须使用 contract/pattern

### 0.2 漂移清单已产出

- 产出文档: `artifacts/phase-0-drift-inventory.md`
- **Token 漂移**: ui/tokens 为 navy+orange，但 tokens.css/index.css/mobile theme 为 blue 系
- **主题协议漂移**: tokens.css 用 `data-theme`，index.css 用 `.dark`
- **Contract/Codegen 漂移**: 6 个 roles 缺失（dropdown-menu, scroll-area, toggle, toggle-group, tooltip, skeleton），多个 roles 的 slots 不完整
- **uix* 使用**: ~94 个文件使用 uix/uixShell/uixPrimitives

### 0.3 Pilot 页面已选定

- 产出文档: `artifacts/phase-0-pilot-selection.md`
- **列表页**: AgentDirectoryPage（典型列表+筛选）
- **详情页**: AgentProfilePage（详情+多 Tab）
- **表单页**: AgentManagePage（创建/编辑表单）

### Open Points

- 无阻塞项，可进入阶段 1

---

## 阶段 1: 收口 UI 真源与主题 (2026-03-17)

### 1.1 scripts/ui/* 脚本模块化

创建了以下独立脚本（单一职责）：

| 脚本 | 职责 |
|------|------|
| `validate-token-schema.mjs` | 验证 ui/tokens/base.json 结构 |
| `validate-theme-schema.mjs` | 验证 ui/tokens/themes/*.json 结构 |
| `validate-contract-schema.mjs` | 验证 ui/contract/contract.json 结构 |
| `build-tokens-css.mjs` | 生成 ui/styles/tokens.css（navy+orange） |
| `build-web-theme.mjs` | 生成 ui/codegen/web-theme.ts |
| `build-mobile-theme.mjs` | 生成 ui/codegen/mobile-theme.ts |
| `build-contract-types.mjs` | 生成 ui/codegen/contract-types.ts（全部 37 roles） |
| `build-contract-manifest.mjs` | 生成 ui/codegen/contract-manifest.json |
| `check-contract-codegen-drift.mjs` | 检测 contract/codegen 一致性 |
| `check-theme-protocol.mjs` | 检测主题协议一致性 |
| `check-generated-clean.mjs` | 检测生成产物是否与源同步 |
| `index.mjs` | 编排入口（仅路由，无业务逻辑） |

### 1.2 npm scripts 接入

添加到 package.json:
- `ui:build` - 运行所有构建脚本
- `ui:check` - 运行所有检查脚本
- `ui:validate` - 运行所有验证脚本
- `ui:tokens:build` - 单独构建 tokens.css
- `ui:theme:web` - 单独构建 web-theme.ts
- `ui:theme:mobile` - 单独构建 mobile-theme.ts
- `ui:contract:build` - 单独构建 contract-types.ts
- `ui:contract:check` - 单独检查 contract/codegen 一致性
- `ui:drift:check` - 检查生成产物漂移

### 1.3 Token/Theme 漂移修复

- **tokens.css**: 从 blue 系修正为 navy+orange（`#283E68`, `#E1703C`）
- **主题协议**: 统一使用 `data-theme="default.dark"` 替代 `:root[data-theme="default.dark"]`
- **contract-types.ts**: 修复缺失的 6 个 roles（dropdown-menu, scroll-area, toggle, toggle-group, tooltip, skeleton）
- **slots**: 修复所有 roles 的 slots 定义（之前部分 roles slots 为 never）

### 1.4 统一样式入口

- 创建 `ui/styles/ui.css` 作为 Web 统一样式入口
- 更新 `ui/spec-version.json` 到 v1.1.0

### Open Points

- index.css 仍使用 `.dark` 类（预期，作为桥接）
- index.css 尚未引入 ui/styles/ui.css（阶段 3 完成）
- Mobile theme.ts 尚未切换到生成产物（阶段 2 包拆分后完成）

---

## 阶段 2: 拆出设计系统包 (2026-03-17)

### 2.1 pnpm-workspace 更新

添加 `packages/*` 到 workspace 范围。

### 2.2-2.5 四包创建

| 包 | 职责 | 依赖 |
|----|------|------|
| `@fun-forum/design-tokens` | token 值与 CSS 变量 | 无 |
| `@fun-forum/ui-contract` | contract 类型与 manifest | 无 |
| `@fun-forum/ui-web` | Web UI 工具（dataUi、theme） | design-tokens, ui-contract |
| `@fun-forum/ui-mobile` | Mobile theme 与工具 | design-tokens, ui-contract |

### 2.6 import boundary lint

添加 ESLint `no-restricted-imports` 规则：
- `design-tokens` / `ui-contract`: 不得依赖其他 @fun-forum 包或 src/frontend
- `ui-web` / `ui-mobile`: 不得互相依赖或依赖 src/frontend
- `src/frontend/shared`: 不得依赖 features

### Open Points

- 包尚未发布（仅 workspace 内使用）
- Mobile 需切换到 @fun-forum/ui-mobile 导入（阶段 4 pilot 或之后）

---

## 阶段 3: 模式组件与 AppShell (2026-03-17)

### 3.1 模式组件（10 个）

在 `packages/ui-web/src/patterns/` 创建：

| 组件 | 用途 |
|------|------|
| PageScaffold | 页面结构包装器 |
| PageHeader | 页面头部（标题、描述、操作） |
| FilterToolbar | 筛选工具栏 |
| ListPageLayout | 列表页布局 |
| DetailPageLayout | 详情页布局 |
| FormPageLayout | 表单页布局 |
| FormField | 表单字段包装器 |
| EmptyState | 空状态展示 |
| StatusBadge | 状态徽章 |
| InlineAlert | 内联提示 |

所有组件使用 `data-ui` / `data-slot` 属性，遵循 7.3 props 原则。

### 3.2 AppShell 与 TopBar

在 `packages/ui-web/src/shell/` 创建：

- `AppShell`: 应用壳层，提供 TopBar/LeftRail/ContentRegion/RightRail 区域
- `TopBar`: 顶部导航栏，提供 logo/navigation/actions 插槽

业务 widgets（notifications, user-menu）应作为 props 传入，不在壳层内硬编码。

### 3.3 导出更新

ui-web package.json 添加：
- `@fun-forum/ui-web/patterns` 导出
- `@fun-forum/ui-web/shell` 导出

### Open Points

- 现有 Layout.tsx 未重构（保持稳定，pilot 迁移后再统一）
- widgets 定义为接口，实际组件在 features 中实现
- ui/styles/ui.css 已创建但 index.css 尚未引入（需 pilot 验证后再切换）

---

## 阶段 4: 试点迁移准备 (2026-03-17)

### 4.1 Pilot 迁移示例

创建 `artifacts/phase-4-pilot-migration-example.md`，展示：
- AgentDirectoryPage 从 uix 迁移到模式组件的示例
- 迁移检查清单

### 4.2 类型检查验证

- `pnpm typecheck` 通过
- 包导出和依赖关系正确

### 4.3 视觉回归准备

视觉回归需在实际迁移后进行。目标页面：
- AgentDirectoryPage（列表页）
- AgentProfilePage（详情页）
- AgentManagePage（表单页）

### Open Points

- 实际页面迁移待执行（需业务稳定窗口）
- 视觉回归测试待实际迁移后执行

---

## 阶段 5: 治理强化 (2026-03-17)

### 5.1 CI 门禁完整

更新 `.github/workflows/ci.yml` 添加：
- `pnpm ui:build` - 构建 tokens/contract/theme 产物
- `pnpm ui:check` - 检查 contract-codegen drift 和主题协议

### 5.2 uix* 迁移计划

添加 ESLint 规则（warning 级别）：
- 导入 `@/shared/utils/uix` 时提示使用 data-ui 和模式组件
- 导入 `@/shared/utils/uix-shell` 时提示使用 AppShell
- 导入 `@/shared/utils/uix-primitives` 时提示使用 data-ui primitives

迁移完成后将升级为 error 级别。

### 5.3 bundle budget

bundle budget 配置建议（待后续实施）：
- 在 vite.config.ts 中配置 manualChunks 分离 vendor/ui
- 设置 build.chunkSizeWarningLimit
- 后续可接入 bundlesize 或 lighthouse CI

### Open Points

- uix* 全量迁移待阶段 4 pilot 验证后执行
- bundle budget 具体数值待基线建立后设定
- 视觉回归工具待选型（Playwright/Chromatic/Percy）
