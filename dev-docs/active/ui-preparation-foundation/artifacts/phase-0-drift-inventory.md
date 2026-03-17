# Phase 0 Drift Inventory

> 生成时间: 2026-03-17
> 目的: 记录 token/theme/contract/codegen/Web/Mobile 各层的漂移情况，为阶段 1 统一提供依据。

---

## 1. Token 颜色漂移

| 源/产物 | primary | accent | focus_ring | 品牌倾向 |
|---------|---------|--------|------------|----------|
| **ui/tokens/base.json** (源) | `#283E68` (navy) | `#E1703C` (orange) | `#283E6866` | navy + orange |
| **ui/tokens/themes/default.light.json** | `#283E68` | `#E1703C` | — | navy + orange |
| **ui/tokens/themes/default.dark.json** | `#5a7ab5` | `#E1703C` | `#5a7ab580` | navy + orange |
| **ui/styles/tokens.css** (生成) | `#2563eb` (blue) | ❌ 无 | `#2563eb66` | **blue 系** |
| **src/frontend/index.css** | oklch(0.45 0.18 270) | oklch 系 | oklch 系 | **shadcn 默认** |
| **apps/mobile/src/theme.ts** | `#2563eb` (blue) | ❌ 无 | — | **blue 系** |

**结论**: 生成 CSS、Web 入口、Mobile theme 均偏离 navy+orange 源，需在阶段 1 统一。

---

## 2. 主题协议漂移

| 位置 | Dark mode 触发方式 |
|------|-------------------|
| **ui/styles/tokens.css** | `:root[data-theme="default.dark"]` |
| **src/frontend/index.css** | `.dark` 类 |
| **apps/mobile** | 无主题切换（单色系） |

**结论**: 协议不一致；决策已确认以 `data-theme` 为唯一长期协议，`.dark` 仅作短期桥接。

---

## 3. Contract → Codegen 漂移

### 3.1 缺失的 Roles

以下 roles 在 `ui/contract/contract.json` 中存在，但在 `ui/codegen/contract-types.ts` 的 `UiRole` 类型中缺失:

- `dropdown-menu`
- `scroll-area`
- `toggle`
- `toggle-group`
- `tooltip`
- `skeleton`

### 3.2 Slots 定义不完整

| Role | contract.json 中的 slots | contract-types.ts 中的 slots |
|------|--------------------------|------------------------------|
| card | header, body, footer, card, card-header, card-title, card-description, card-action, card-content, card-footer | header, body, footer |
| select | select, select-group, select-value, select-trigger, select-content, select-label, select-item, select-item-indicator, select-separator, select-scroll-up-button, select-scroll-down-button | ❌ never |
| modal | header, body, footer + dialog-*, sheet-* (20+ slots) | header, body, footer |
| avatar | avatar, avatar-image, avatar-fallback, avatar-badge, avatar-group, avatar-group-count | ❌ never |
| tabs | tabs, tabs-list, tabs-trigger, tabs-content | ❌ never |
| badge | badge | ❌ never |
| button | button | ❌ never |
| divider | separator | ❌ never |

**结论**: codegen 脚本未完整读取 contract.json 的 slots，需在阶段 1 修复 build-contract-types 脚本。

---

## 4. spec-version 同步状态

```json
{
  "ui_spec_version": "1.0.0",
  "generated_at_utc": "2026-02-20T14:08:50Z",
  "notes": "B1 Tailwind boundary; data-ui contract; themes are token-only."
}
```

- 最后生成时间: 2026-02-20
- 与 contract.json 更新时间可能不同步（contract 中有 dropdown-menu 等新 roles 但未重新生成）

---

## 5. Web 入口 (src/frontend/index.css) 现状

- **框架**: Tailwind + shadcn
- **颜色系统**: 使用 oklch 颜色空间，与 ui/tokens 的 hex 格式不同
- **变量命名**: `--background`, `--foreground`, `--primary` 等（shadcn 风格），与 `--ui-color-*` 不同
- **主题**: 定义了 `:root` 和 `.dark` 两套变量
- **引入**: 未引入 `ui/styles/tokens.css` 或 `ui/styles/ui.css`

**结论**: Web 入口需改为引入 ui/styles/ui.css 作为统一样式入口，index.css 仅保留 Tailwind 入口与桥接。

---

## 6. Mobile theme (apps/mobile/src/theme.ts) 现状

- **颜色**: 手写常量，使用 blue 系 (`#2563eb`)
- **间距**: `xs/sm/md/lg/xl` 与 ui/tokens 的 `0-8` 命名不同
- **圆角**: `sm/md` 与 ui/tokens 的 `sm/md/lg/full` 部分对齐
- **无主题切换**: 单一 light 色系

**结论**: 需在阶段 1 生成 Mobile theme 产物，替换手写 theme。

---

## 7. uix* 使用情况统计

| 模块 | 使用 uix* 的文件数 |
|------|-------------------|
| src/frontend/components/ui | 17 |
| src/frontend/shared | 10 |
| src/frontend/features/agents | 15 |
| src/frontend/features/chat | 12 |
| src/frontend/features/forum | 12 |
| src/frontend/features/auth | 8 |
| src/frontend/features/admin | 10 |
| src/frontend/features/dashboard | 2 |
| src/frontend/features/guidance | 3 |
| src/frontend/features/private-chat | 3 |
| src/frontend/features/user | 1 |
| src/frontend/features/help | 1 |
| **总计** | **~94 文件** |

**核心文件**:
- `src/frontend/shared/utils/uix.ts` (定义)
- `src/frontend/shared/utils/uix-shell.ts` (定义)
- `src/frontend/shared/utils/uix-primitives.ts` (定义)

**结论**: uix* 使用面广，需在阶段 3/4/5 分批迁移后移除。

---

## 8. 待修复优先级

| 优先级 | 项目 | 阶段 |
|--------|------|------|
| P0 | tokens.css 生成逻辑修正 (navy+orange) | 1 |
| P0 | 主题协议统一 (data-theme) | 1 |
| P0 | contract → codegen 一致性 | 1 |
| P1 | Mobile theme 生成 | 1 |
| P1 | Web 入口改为引入 ui/styles/ui.css | 3 |
| P2 | uix* 迁移移除 | 5 |
