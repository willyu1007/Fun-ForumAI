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

### G. warning 清理收口与 legacy helper 删除（2026-03-18）

- 在基础组件层清理 `uix-primitives` / `uix`：
  - `src/frontend/components/ui/*` 17 个基础件移除了 legacy helper import，改为显式 class 或等价 `cva` variant 字符串。
  - lint warning 基线从 `90` 降到 `73`。
- 在 auth / guidance / help 层继续清理：
  - `src/frontend/features/auth/*`
  - `src/frontend/features/guidance/*`
  - `src/frontend/features/help/pages/PolicyPages.tsx`
  - `src/frontend/shared/components/RichTextLite.tsx`
  - lint warning 基线从 `73` 降到 `60`。
- 对剩余 60 个 `@/shared/utils/uix` 使用点执行 bulk codemod：
  - 前置校验确认所有 `uix(...)` 都是字面量 key，不存在动态 key 调用。
  - 将 `uix('literal-key')` 全量替换为解析后的显式 class 字符串。
  - 删除 admin / agents / chat / dashboard / forum / private-chat / safety 等功能簇中的全部 legacy `uix` import。
- 迁移过程中发现 `SafetyCenterPage` 存在一个漏映射的脏 key：`uix-a10c4b5d31` 不在 `uix-map.ts` 中。
  - 处理方式不是继续保留“原 key 作为 class 名”，而是直接补成显式 info-box 样式：`rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-950`。
- 在确认仓库内已无任何消费者后，删除全部 legacy UI helper：
  - `src/frontend/shared/utils/uix.ts`
  - `src/frontend/shared/utils/uix-map.ts`
  - `src/frontend/shared/utils/uix-shell.ts`
  - `src/frontend/shared/utils/uix-primitives.ts`
- 当前 lint warning 基线已收口到 `0 error / 0 warning`。

### H. 产物清理与后续需求文档落地（2026-03-18）

- 清理了当前仓库中的构建/测试产物目录：
  - root `dist/`
  - `packages/design-tokens/dist`
  - `packages/ui-contract/dist`
  - `packages/ui-mobile/dist`
  - `packages/ui-web/dist`
- 在根目录新增两份后续需求文档，作为下一阶段工作的入口：
  - `bundle-budget-requirements.md`
  - `page-visual-regression-requirements.md`
- 两份文档都按“背景 / 目标 / 范围 / MUST/SHOULD / 验收 / 验证”组织，避免后续执行时重新口头对齐。

---

## 首期页面视觉回归落地（2026-03-18）

### A. 构建 / 运行前置修复

- 新增 `workspace-package-aliases.ts`，为 `vite.config.ts` / `vitest.config.ts` 提供显式 workspace alias，修复 fresh install 后 `@fun-forum/ui-web/theme` 无法在 root app 被解析的问题。
- `src/frontend/api/use-sse.ts` 新增 `VITE_FF_DISABLE_SSE` 开关；视觉模式下可直接禁用 `/v1/events/stream` 自动连接，避免 mocked `/v1` 环境持续重连污染截图。

### B. 稳定视觉定位 contract

- `packages/ui-web/src/shell/AppShell.tsx` 增加：
  - `data-testid="app-shell"`
  - `data-testid="app-shell-content"`
- 3 个试点页补齐根节点与关键状态标记：
  - `AgentDirectoryPage`: root / loading / error / empty / results
  - `AgentProfilePage`: root / loading / error / summary / narrative
  - `AgentManagePage`: root / anonymous / form / error / created
- `AgentCreateWizard` 补 `data-testid="agent-create-wizard"`，用于 overlay 场景截图。

### C. Playwright 基座与共享 mock 层

- 新增根级 `playwright.config.mjs`：
  - 浏览器固定 Chromium
  - 3 个 viewport：`1440x900` / `768x1024` / `390x844`
  - 运行上下文固定 `default.light`、`zh-CN`、`Asia/Shanghai`
  - `snapshotPathTemplate` 去掉平台后缀，避免本地 `darwin` 与 CI `linux` 各自产生一套 baseline
  - `trace` / `video` / `screenshot` 失败保留
  - report 输出到 `artifacts/playwright/`
  - web server 固定为 `pnpm build && vite preview`
- 新增 npm scripts：
  - `pnpm test:e2e:playwright`
  - `pnpm test:e2e:playwright:update`
- 新增 `tests/web/playwright/support/`：
  - 冻结时间、禁用动画、固定随机数
  - 通用 AppShell `/v1` mock
  - pilot 页面 mock data factory
  - unhandled API request hard fail

### D. 首期页面矩阵与基线

- 新增 3 个 spec：
  - `tests/web/playwright/agents-directory.visual.spec.ts`
  - `tests/web/playwright/agent-profile.visual.spec.ts`
  - `tests/web/playwright/agent-manage.visual.spec.ts`
- 覆盖的 15 个场景：
  - `/agents`: loading / error / empty / happy / filtered + long-content
  - `/agents/:agentId`: loading / error / spectator happy / owner happy / long-content + multi-tag
  - `/agents/manage`: anonymous / empty form / mutation error / create success / wizard overlay
- baseline 落在 `tests/web/playwright/*-snapshots/`，共 `45` 张 PNG。

### E. CI / PR gate

- `.github/workflows/ci.yml` 新增独立 `web-playwright` job。
- job 通过 `node .ai/skills/features/ci/scripts/ci-verify.mjs --suite web-playwright` 执行：
  - browser install
  - Playwright visual regression
- 无论成败都上传 `artifacts/playwright/`。

### Remaining Risks

- 首期 3 个试点页已完成视觉回归，但第二波 P0 页面（`/rooms*`、`/agents/:agentId/chat`、`/admin`、`/agents/:agentId/dashboard`、`/`、`/posts/*` 等）仍待补齐。
- `pnpm build` 现在通过，但 Vite 仍提示存在大 chunk（当前主 bundle 仍超过 `500 kB` warning 阈值）；bundle budget 与分包策略仍是后续工作。
- 本轮大量文件通过等价 class 替换移除了 `uix*`，后续如果要继续收口重复样式，应优先抽回 pattern/component 层，而不是重新引入字符串映射工具。

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

---

## 首期视觉回归代码质量复核 (2026-03-18)

### A. workspace alias 与 ESM 运行时修正

- `workspace-package-aliases.ts` 不再依赖 `__dirname`，改为通过 `import.meta.url + fileURLToPath()` 解析仓库根路径。
- 这样可避免后续在 ESM 配置上下文里出现“本地能跑、fresh install / preview / CI 失效”的路径解析漂移。

### B. Playwright mock fixture 类型收口

- `tests/web/playwright/support/mock-data.ts` 改为直接复用前端 API 类型：
  - `UserProfile`
  - `Agent` / `AgentSearchItem`
  - `Community`
  - `Notification`
  - `OwnerLifeOverview`
  - 以及 profile / credit / trait / run 相关 DTO
- `tests/web/playwright/support/helpers.ts` 的 `CommonAppMocks` 也从宽泛 `Record<string, unknown>` 收口为真实业务类型，避免 mock shape 与运行时代码脱节。

### C. 测试稳定性加固

- `prepareVisualPage()` 中的冻结时间从覆盖 `window.Date` 改为覆盖 `globalThis.Date`，让页面脚本与模块脚本都使用同一套冻结时钟。
- `expectPageSnapshot()` 改为复用单个 `#visual-regression-stabilizer` style 节点，不再每次截图都追加新的 style tag。
- `buildOwnerLifeOverview()` 改为接受 `agentId` 参数，避免 owner profile 场景在深链和 CTA 上错误指向固定的 `agent-1`。

### D. 复核结论

- 本轮未发现新的 blocker，但发现并修复了 4 类容易在后续扩面时放大的实现缺陷：
  - ESM 路径解析假设
  - fixture 与 API 类型漂移
  - 冻结时钟作用域不完整
  - repeated style injection 与假数据硬编码
- 修复后重新执行 build、Playwright 全量用例、针对新增文件的 ESLint，结果均通过。
