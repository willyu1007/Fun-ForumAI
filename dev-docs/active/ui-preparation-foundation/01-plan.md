# 01 Plan — ui-preparation-foundation

## 阶段与步骤总览

| 阶段 | 步骤编号 | 步骤摘要 | 依赖 |
|------|----------|----------|------|
| 0 | 0.1 | 冻结新增视觉常量；禁止新增 uix* | — |
| 0 | 0.2 | 产出 current-state inventory、漂移清单（token/theme/contract/codegen/spec-version） | 0.1 |
| 0 | 0.3 | 选定 pilot 页面（列表/详情/表单各一） | 0.2 |
| 1 | 1.1 | 确立 canonical source（ui/tokens + themes），品牌统一为 navy+orange | 0.2 |
| 1 | 1.2 | 统一主题协议为 data-theme；实现 applyTheme 入口（可选 .dark 短期桥） | 1.1 |
| 1 | 1.3 | 实现 scripts/ui/* 独立脚本（validate/build/check），index.mjs 仅编排 | 1.1 |
| 1 | 1.4 | 接入 package.json 中 ui:* npm scripts | 1.3 |
| 1 | 1.5 | Web/Mobile 从统一产物取主题；CI 中 ui:build、ui:check、drift 检测 | 1.4 |
| 2 | 2.1 | pnpm-workspace 增加 packages/* | 1.5 |
| 2 | 2.2 | 拆出 packages/design-tokens（读 ui/tokens，产出 dist） | 2.1, 1.3 |
| 2 | 2.3 | 拆出 packages/ui-contract（读 ui/contract，产出 types/manifest） | 2.1, 1.3 |
| 2 | 2.4 | 拆出 packages/ui-web（依赖 design-tokens、ui-contract；primitives） | 2.2, 2.3 |
| 2 | 2.5 | 拆出 packages/ui-mobile（依赖 design-tokens、ui-contract；primitives） | 2.2, 2.3 |
| 2 | 2.6 | 建立 import boundary 规则并接入 lint | 2.4, 2.5 |
| 3 | 3.1 | 在 ui-web 中实现 10 个模式组件（按 7.3 props 原则） | 2.4 |
| 3 | 3.2 | 从 Layout 拆出 AppShell + TopBar/LeftRail/RightRail/ContentRegion | 2.4 |
| 3 | 3.3 | 将通知/用户菜单/guidance/safety 封装为 widget，在 app 层注入 | 3.2 |
| 3 | 3.4 | Web 以 ui/styles/ui.css 为统一样式入口，index.css 仅桥接 | 2.2, 1.5 |
| 3 | 3.5 | 模式组件与 primitives 输出 data-ui/data-slot | 3.1 |
| 4 | 4.1 | 列表页 pilot 迁移到 ListPageLayout 等模式组件 | 3.1, 0.3 |
| 4 | 4.2 | 详情页、表单页 pilot 迁移 | 3.1, 0.3 |
| 4 | 4.3 | 建立首批视觉回归（PageHeader/FilterToolbar/FormField/EmptyState + 三样板） | 3.1 |
| 5 | 5.1 | 全量 uix* 迁移并移除实现，新代码禁止 uix* | 4.1, 4.2 |
| 5 | 5.2 | vite manualChunks + bundle budget 配置 | 2.4 |
| 5 | 5.3 | CI 门禁完整：ui:build、ui:check、contract-codegen drift、视觉回归 | 1.5, 4.3 |

---

## 阶段 0：冻结与审计

**目标**：冻结新增、摸清漂移、确定试点。

- **0.1** 在 README 或 dev-docs 中明确：禁止在 index.css/components.json/apps/mobile theme 等处新增视觉常量；禁止新增 uix('...')/uixShell('...') 等 key。可选：ESLint 或 grep 门禁。
- **0.2** 产出文档：current-state inventory（ui/tokens、ui/contract、ui/codegen、ui/styles、index.css、components.json、apps/mobile theme 当前内容摘要）；漂移清单（token 与生成 CSS 差异、contract 与 contract-types 差异、spec-version 与产物是否同链）。
- **0.3** 选定 pilot：列表页（如 AgentDirectoryPage/ChatRoomListPage）、详情页（如 AgentProfilePage/PostDetailPage）、表单页（如 AgentManagePage/RegisterPage）各一，写入 00-overview 或 01-plan。

**通过条件**：团队对“先收口再铺页面”一致；漂移清单明确；pilot 名单明确。

---

## 阶段 1：收口 UI 真源与主题机制

**目标**：唯一真源、单一主题协议、可重复生成、CI 可检 drift。

- **1.1** 以 ui/tokens/base.json 与 ui/tokens/themes/default.light.json、default.dark.json 为 canonical source；将生成产物与 Web/Mobile 视觉统一为 navy+orange（修改 token 或生成逻辑，二选一收口）。
- **1.2** 主题切换统一为 document.documentElement.dataset.theme = 'default.light' | 'default.dark'；如需短期兼容 .dark，仅在 applyTheme 内同时 set classList，不长期双协议。
- **1.3** 在仓库根创建 scripts/ui/，实现独立 ESM 脚本：validate-token-schema.mjs、validate-theme-schema.mjs、validate-contract-schema.mjs、build-tokens-css.mjs、build-web-theme.mjs、build-mobile-theme.mjs、build-contract-types.mjs、check-generated-clean.mjs、check-contract-codegen-drift.mjs、check-theme-protocol.mjs；index.mjs 仅接收 build/check 等命令并调用上述脚本。每个脚本单一职责、可单独运行、可断言成功/失败。
- **1.4** 在 package.json 增加：ui:build、ui:check、ui:tokens:build、ui:theme:web、ui:theme:mobile、ui:contract:build、ui:contract:check、ui:drift:check（对应文档附录 12.2）。
- **1.5** Web 入口与 Mobile 入口改为从统一生成产物读取主题（或占位注入）；CI 增加步骤：pnpm ui:build、pnpm ui:check；drift 失败即 CI 失败。

**通过条件**：Web/Mobile 能从统一产物拿到主题；token → 产物链路可重复执行；CI 能检测 generated drift。

---

## 阶段 2：拆出设计系统包与边界

**目标**：4 个包就位、依赖单向、import boundary 可查。

- **2.1** 修改 pnpm-workspace.yaml：packages: ['apps/*', 'packages/*']。
- **2.2** 新建 packages/design-tokens：源码读 ui/tokens（或通过 build 从 ui/tokens 生成）；产出 dist/web.css、dist/mobile.ts（或等同）；不依赖业务。
- **2.3** 新建 packages/ui-contract：源码读 ui/contract/contract.json；产出 dist/contract-types.ts、manifest、validators 等；不依赖业务。
- **2.4** 新建 packages/ui-web：依赖 design-tokens、ui-contract；包含 primitives（Button/Input/Dialog/Tabs 等，可包装现有 shadcn/Radix）；不依赖 features/API hooks。
- **2.5** 新建 packages/ui-mobile：依赖 design-tokens、ui-contract；包含 RN 用 primitives 与 theme 消费；不依赖业务。
- **2.6** 配置 import boundary lint（如 eslint-plugin-import 或 custom rule）：shared 不依赖 features；features 不互相依赖内部；packages/* 不依赖 src/frontend/features。

**通过条件**：UI 包不依赖业务；shared 不反向依赖 feature；Web/Mobile 可从包层消费统一产物。

---

## 阶段 3：模式组件层与 AppShell

**目标**：10 个模式组件可用、壳层与业务分离、Web 消费 ui/styles。

- **3.1** 在 packages/ui-web 中实现：PageScaffold、PageHeader、FilterToolbar、ListPageLayout、DetailPageLayout、FormPageLayout、FormField、EmptyState、StatusBadge、InlineAlert；props 遵循文档 7.3（结构/内容/状态、有限枚举、不暴露视觉 token）。
- **3.2** 在 src/frontend/app/shell/ 拆出 AppShell.tsx、TopBar、LeftRail、RightRail、ContentRegion；Layout 改为组装这些区域，不直接吞业务逻辑。
- **3.3** 将通知铃、用户菜单、guidance 入口、safety 入口等封装为独立 widget（如 src/frontend/widgets/notifications、user-menu、guidance、safety）；在 app 层注入到 AppShell 区域，widget 自管业务 hooks。
- **3.4** 前端入口引入 ui/styles/ui.css 为统一样式入口；src/frontend/index.css 仅保留 Tailwind 入口、ui 引用、必要 reset/桥接，不再定义独立颜色/主题变量。
- **3.5** 模式组件与 primitives 输出 data-ui、data-slot（及必要 data-* 属性），符合 ui/contract。

**通过条件**：至少三类页面模式可复用；Layout 不再吞并大量业务逻辑；新页面可以模式组件为首选入口。

---

## 阶段 4：试点迁移

**目标**：三个 pilot 用模式组件重写、视觉回归建立。

- **4.1** 列表页 pilot：用 ListPageLayout、FilterToolbar、PageHeader、EmptyState 等重写，移除对 uix* 的依赖。
- **4.2** 详情页 pilot、表单页 pilot：同理用 DetailPageLayout/FormPageLayout、FormField 等重写。
- **4.3** 为 PageHeader、FilterToolbar、FormField、EmptyState 及 ListPageLayout/DetailPageLayout/FormPageLayout 样板建立视觉回归（截图或 Storybook + 回归脚本）。

**通过条件**：新模式明显减少 ad-hoc CSS；单页改动不波及其他模块；视觉回归可重复运行。

---

## 阶段 5：治理强化与 uix* 移除

**目标**：uix* 全部迁移并移除、bundle 策略与 CI 门禁完整。

- **5.1** 按页面/模块将剩余 uix* 用法迁移到 pattern/contract；删除或收口 uix/uix-shell/uix-primitives 实现；新代码禁止 uix*（lint 或 code review 保证）。
- **5.2** 在 vite.config 中配置 manualChunks（如 react、radix、react-query、chat、admin 等）；设定 bundle budget（可先测基线再定阈值）。
- **5.3** CI 中完整门禁：ui:build、ui:check、contract-codegen drift、视觉回归（可仅对关键组件）；无 approval 的规范变更不合并。

**通过条件**：新代码不再依赖 uix*；复杂页能接入统一基础层；UI 质量门禁为主分支默认规则。

---

## 步骤依赖与冲突自检

- **0 → 1**：阶段 0 产出漂移清单与 pilot，阶段 1 据此修 token 与主题；无冲突。
- **1 → 2**：阶段 1 产出 scripts 与生成产物，阶段 2 的 design-tokens/ui-contract 可复用同一脚本或在包内调用；生成产物先落 ui/ 再由包 dist 引用或包 build 时生成均可，约定清晰即可。无冲突。
- **2 内部**：2.2、2.3 仅依赖 2.1 与 1.3；2.4、2.5 依赖 2.2、2.3，顺序正确。2.6 依赖包已存在。无冲突。
- **2 → 3**：模式组件依赖 ui-web（2.4）；AppShell 依赖现有 Layout 结构，与包无循环依赖。无冲突。
- **3 → 4**：pilot 迁移依赖 3.1 模式组件与 0.3 pilot 名单。无冲突。
- **4 → 5**：uix* 移除必须在有足够 pattern 替代后进行，故 5.1 放在 4 之后；5.2、5.3 可与 5.1 并行或稍后。无冲突。
- **潜在冲突**：若在阶段 3 前就删除 uix*，会导致尚未迁移的页面报错。**缓解**：5.1 明确为“全量迁移后再移除”，且 4.1/4.2 已用模式组件替代 pilot 页的 uix*。

---

## 验收标准（对应文档十一）

- **11.1** 真源与主题：ui/tokens+themes 为唯一视觉源；Web/Mobile 不手写独立视觉；dark 协议统一；产物可重建。
- **11.2** 运行时消费：Web 默认统一样式入口；Mobile 默认统一 generated theme；页面不以 ad-hoc 视觉变量为主入口。
- **11.3** 组件层级：原子/模式/页面边界清晰；至少三类模式落地；新页面以模式为首选。
- **11.4** 边界与解耦：packages 边界成立；shared 不依赖 feature；AppShell 与挂件分离；UI 包不依赖业务 hooks。
- **11.5** 治理与门禁：ui:build/check 入 CI；contract-codegen drift 可检；uix* 禁止；关键模式有视觉回归。
- **11.6** 团队执行：默认路径清晰；规范变更与例外有审批；例外可追踪可清理；不以 utility 为长期体系。
