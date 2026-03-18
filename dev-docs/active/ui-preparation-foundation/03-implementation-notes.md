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
- Mobile 需切换到生成主题消费（已于 2026-03-18 完成桥接）

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

- 现有 Layout.tsx 未重构（该项已于 2026-03-18 切换为 AppShell 组合）
- widgets 定义为接口，实际组件在 features 中实现
- ui/styles/ui.css 已创建但 index.css 尚未引入（该项已于 2026-03-18 切换）

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

## PR #15 收口与可合并修复 (2026-03-18)

### A. 包边界从“目录占位”收口为可消费模块

- 新增 `scripts/ui/sync-package-artifacts.mjs`，将 UI SSOT 生成物同步到包内可消费路径：
  - `packages/design-tokens/src/generated/*`
  - `packages/design-tokens/styles/tokens.css`
  - `packages/ui-contract/src/generated/*`
  - `packages/ui-contract/contract/*`
  - `packages/ui-web/styles/contract.css`
- 新增 `scripts/ui/check-package-typecheck.mjs`，把 design-tokens / ui-contract / ui-web / ui-mobile / mobile app 的类型检查纳入 `ui:check`。
- 新增 `scripts/ui/build-package-dists.mjs`，按依赖顺序编译 4 个 UI workspace packages 的 `dist/` 产物。
- 新增 `scripts/ui/check-package-runtime-consumption.mjs`，直接验证：
  - `packages/*/dist/*.js` 可被 Node 加载
  - root app 可导入 `@fun-forum/ui-web` / `@fun-forum/ui-web/theme`
  - mobile app 可导入 `@fun-forum/ui-mobile/theme`
- `check-generated-clean.mjs` 扩展到 package-local artifacts，避免只检查 `ui/` 而遗漏工作区包消费层。
- 4 个包的 `package.json` 导出改为真正的 `dist` 消费：
  - `main` / `types` / `exports` 指向 `dist/*.js` / `dist/*.d.ts`
  - `files` 从源码目录收敛到 `dist` + 必要的 styles/contract/tokens 资产
- 包源码切到 NodeNext ESM 相对导入（`.js` 后缀），解决 `dist/*.js` 无法被 Node 直接加载的问题。
- `ui-contract/manifest` 不再运行时导入 JSON，而是消费生成的 TypeScript 常量，移除 ESM JSON 依赖。
- 删除已无消费者的 `build-contract-manifest.mjs` 与 `contract-manifest.json` 生成链路，避免保留无效脚本和冗余产物。
- 删除 `@fun-forum/design-tokens` 中指向不存在 `tokens/` 目录的无效导出声明。

### B. Web 与 Mobile 运行时真正接入统一 UI SSOT

- Web:
  - `src/frontend/index.css` 改为统一引入 `@fun-forum/ui-web/styles`
  - 删除旧的手写 `:root` / `.dark` theme 变量块，仅保留 Tailwind bridge
  - `src/frontend/main.tsx` 启动时默认应用 `default.light`
- Mobile:
  - `packages/ui-mobile/src/theme.ts` 改为消费 `@fun-forum/design-tokens/mobile-theme`
  - `apps/mobile/src/theme.ts` 改为对生成主题的兼容包装，保留旧调用方 API
  - `build-mobile-theme.mjs` 增补 `onPrimary` / `onAccent`，补齐移动端语义色

### C. Contract -> style -> primitive 闭环打通

- `ui/styles/ui.css` 重新接入 `contract.css`
- `ui/styles/contract.css` 批量从旧下划线 token 名切到与 `tokens.css` 一致的 kebab-case token 名
- Web primitives 补充 `data-ui` / `data-variant` / `data-size` / `data-state`，覆盖 button、input、textarea、select、card、dialog、sheet、tabs、avatar、toggle、tooltip 等基础件
- `src/frontend/shared/components/Layout.tsx` 改为组合 `@fun-forum/ui-web/shell` 的 `AppShell`

### D. 构建/校验门禁强化

- `check-theme-protocol.mjs` 将以下情况升级为 hard fail：
  - `src/frontend/index.css` 未引入 `@fun-forum/ui-web/styles`
  - 仍存在 legacy `.dark { ... }` theme block
- `build-tokens-css.mjs` 生成 `:root[data-theme="default.light"]`，让 light theme 也通过同一协议输出
- root app 改回通过 workspace package 正常解析，不再依赖 package source alias：
  - `tsconfig.app.json` 移除 `@fun-forum/*` 源码 paths
  - `vite.config.ts` 移除 UI 包源码 alias，仅保留前端 `@` alias
- root scripts 增加 `predev:frontend` / `prebuild` / `pretypecheck` / `preui:check` / `premobile:*`，确保真实 consumer 在运行前拥有最新 `dist` 产物。
- lint 覆盖扩展到 `packages`、`apps/mobile/src`、`scripts/ui`，并为 `scripts/ui/**/*.mjs` 增加 Node ESM lint 配置。

### E. 命名歧义与重复债务收口（2026-03-18）

- 后端文案模块重命名，消除 `-copy` 歧义：
  - `src/backend/services/governance-request-copy.ts` → `src/backend/services/governance-text.ts`
  - `src/backend/services/review-service/notification-copy.ts` → `src/backend/services/review-service/linked-request-notification-text.ts`
- 将投诉/申诉/治理对象的共用文案收口到 `governance-text.ts`：
  - 新增 `appealAudienceLabel`
  - 新增 `governanceTargetLabel`
  - 保留并复用 `governanceRequestLabel` / `governanceRequestEntryLabel` / `complaintAudienceLabel`
- `complaint-appeal-service.ts` 与 `review-service/linked-request-sync.ts` 改为消费共用 helper，移除重复的 appeal 标题基文案和 target label 拼装逻辑。
- 新增 `packages/tsconfig.base.json`，4 个 UI workspace packages 统一继承同一套 TypeScript 编译基线。
- 共享基类仅保留“与包位置无关”的编译选项；`rootDir` / `outDir` / `include` / `exclude` 继续留在各包内，避免 TypeScript 按基类文件位置解析相对路径而导致配置漂移。

### F. warning 清理第一批（2026-03-18）

- 清理了全部 `uix-shell` warning：
  - `src/frontend/shared/components/Layout.tsx`
  - `src/frontend/shared/components/LeftSidebar.tsx`
  - `src/frontend/shared/components/RightSidebar.tsx`
  - `src/frontend/shared/components/AgentPanel.tsx`
  - `src/frontend/shared/components/DevAuthToolbar.tsx`
  - `src/frontend/shared/components/LoadMore.tsx`
  - `src/frontend/shared/components/OnboardingBar.tsx`
  - `src/frontend/app/route-components.tsx`
- 处理方式是等价 class 替换，移除 `@/shared/utils/uix-shell` 依赖本身，不通过改 lint 规则或改 import 路径规避 warning。
- Mobile 端修复了 `react-refresh/only-export-components` warning：
  - 新增 `apps/mobile/src/auth/auth-state.ts`
  - 新增 `apps/mobile/src/auth/use-auth.ts`
  - `apps/mobile/src/auth/auth-context.tsx` 现在只导出 `AuthProvider`
- 当前 lint warning 基线从 `99` 降到 `90`。
- 剩余 warning 全部属于 legacy UI 存量：
  - `86` 个 `@/shared/utils/uix`
  - `4` 个 `@/shared/utils/uix-primitives`

### Remaining Risks

- `pnpm lint` 仍有 99 个 warning：
  - 98 个来自既有 `uix*` / `uix-shell` / `uix-primitives` 存量使用点
  - 1 个来自 `apps/mobile/src/auth/auth-context.tsx` 的 React Fast Refresh warning
- 当前 warning 均不阻塞 PR 合并，但说明样式迁移和移动端 lint 收口仍有后续工作。
- 页面级 pilot 迁移、视觉回归、bundle budget 仍在本任务后续范围内。

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
