# Phase 0 Freeze Rules

> 生效时间: 2026-03-17
> 目的: 冻结新增视觉常量与 uix* key，防止漂移进一步扩大。

---

## 冻结规则

### 规则 1: 禁止新增视觉常量

以下位置 **禁止新增** 颜色、间距、圆角、阴影等视觉常量:

| 位置 | 说明 |
|------|------|
| `src/frontend/index.css` | 不得新增 `--background`, `--primary` 等变量 |
| `components.json` | 不得修改 baseColor 或新增自定义配色 |
| `apps/mobile/src/theme.ts` | 不得新增颜色或间距常量 |
| 任何 `.tsx` / `.css` 文件 | 不得硬编码 `#xxx` 颜色值（除非经 approval） |

**唯一允许的视觉真源**: `ui/tokens/base.json` + `ui/tokens/themes/*.json`

### 规则 2: 禁止新增 uix* key

以下调用 **禁止新增**:

```typescript
// 禁止新增
uix('any-new-key')
uixShell('any-new-key')
uixPrimitive('any-new-key')
```

**现有调用**: 可保留运行，但需按计划迁移并最终移除。

### 规则 3: 新代码必须使用 contract/pattern

新增 UI 代码应:

1. 使用 `data-ui` / `data-slot` 属性（符合 `ui/contract/contract.json`）
2. 使用模式组件（阶段 3 后可用）
3. Tailwind 仅用于 layout（`flex`, `grid`, `gap`, `p-*`, `m-*`）
4. 视觉样式从 `ui/styles/ui.css` 获取

---

## 违规处理

1. **Code Review**: PR 中若发现违规，应指出并要求修改
2. **后续 Lint**: 阶段 1 完成后可接入 ESLint 规则检测 uix* 新增
3. **例外审批**: 如有特殊情况需突破规则，必须在 `ui/approvals/` 中提交 exception

---

## 生效范围

- `src/frontend/**`
- `apps/mobile/**`
- `ui/**`（仅允许修改 tokens/contract/patterns 源文件，不允许手改生成产物）

---

## 相关文件

- [漂移清单](./phase-0-drift-inventory.md)
- [Pilot 选定](./phase-0-pilot-selection.md)
- [01-plan.md](../01-plan.md) 阶段 0.1
