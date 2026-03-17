# 02 Architecture — repo-baseline-governance-and-ui-remediation

## Boundaries
- 运行时视觉样式从 `src/frontend/**` 回收到 `ui/contract/contract.json`、`ui/styles/contract.css`、`ui/styles/ui.css`、`ui/styles/tokens.css`。
- `src/frontend/**` 中保留的 Tailwind 仅限 layout-safe utilities。
- shared UI primitives 继续承担交互/可访问性职责，但视觉实现必须与 contract/token 层对齐。

## Decision Points
- `T-084` 不扩成 umbrella task；本任务单独承接 repo 基线治理，避免目标混淆。
- `contract-slot` warning 采用“最小 contract 扩展 + 共享组件对齐 contract”的路径，不做简单删除 `data-slot`。
- ad-hoc `data-ui`（例如 `room-director-panel`）不加入 contract，统一替换为已有 role 组合。
- duplicate 文件清理仅限未跟踪、可证明有 canonical sibling、且无独立引用的 `" 2"` 后缀文件。
