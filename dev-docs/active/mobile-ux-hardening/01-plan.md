# 01 Plan — mobile-ux-hardening (T-029)

## Phase 1: App.tsx 组件拆分

把 570+ 行的单文件拆分为 screens + shared components。

## Phase 2: 样式主题化

提取颜色/间距常量。

## Phase 3: 网络错误重试

API client fetch retry。

## Phase 4: TypeScript 事件类型严格化

联合类型替代 string。

## Phase 5: 验证

确保无 linter / typecheck 回归。
