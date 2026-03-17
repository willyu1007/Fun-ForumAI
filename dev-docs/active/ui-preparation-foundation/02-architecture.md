# 02 Architecture — ui-preparation-foundation

## 分层与边界

- **第 0 层** Design Tokens：ui/tokens/base.json + ui/tokens/themes/*.json，只读于生成脚本与 packages/design-tokens。
- **第 1 层** UI Contract：ui/contract/contract.json，只读于生成脚本与 packages/ui-contract。
- **第 2 层** Patterns：ui/patterns/*.md，供模式组件实现与 lint 参考。
- **第 3 层** Codegen/Artifacts：ui/styles/tokens.css、ui/codegen/*、packages/design-tokens/dist、packages/ui-contract/dist；不可手改，仅脚本生成。
- **第 4 层** Primitives：packages/ui-web、packages/ui-mobile 中的 Button/Input/Dialog 等；依赖 design-tokens、ui-contract。
- **第 5 层** Pattern Components：PageScaffold、PageHeader、FilterToolbar 等，位于 packages/ui-web（及 ui-mobile 对应）。
- **第 6 层** Feature Pages：src/frontend/features/*，仅组合 pattern + 数据与状态；依赖 shared、packages/*。
- **第 7 层** App Shell：src/frontend/app/shell/* + widgets；只提供区域与挂载点，业务逻辑在 widget 或 feature。

## 依赖方向（单向）

- design-tokens、ui-contract：不依赖 app/features。
- ui-web、ui-mobile：仅依赖 design-tokens、ui-contract。
- src/frontend/shared：仅依赖 packages/* 与自身。
- src/frontend/features/*：依赖 shared、packages/*；不依赖其他 feature 内部。
- src/frontend/app/*：依赖 features、shared、packages/*。

禁止：shared → features；packages → 业务 hooks/API；feature A → feature B 内部。

## 关键接口

- **主题应用**：单一入口设置 `document.documentElement.dataset.theme`（及可选 .dark 桥）。
- **样式入口**：Web 以 `ui/styles/ui.css` 为统一样式入口；index.css 仅桥接。
- **模式组件 API**：以 slot（header/content/footer/actions 等）与有限枚举（density、variant）为主；不暴露 raw 视觉 token。

## 风险与缓解

- **contract 与 codegen 漂移**：CI 中 check-contract-codegen-drift 失败即阻断；每次改 contract 必须跑 ui:contract:build。
- **Tailwind 重新变成视觉真源**：governance 与 lint 限定 Tailwind 仅 layout；视觉由 token/contract 层控制。
- **exception 失控**：approval 中 exception 必须有 owner、expiresAt、cleanupPlan；定期审查。
