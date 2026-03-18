# 05 Pitfalls — ui-preparation-foundation

（已解决的历史问题与“勿再犯”摘要；非当前 open issue。）

## do-not-repeat 摘要

- 2026-03-18：共享 `tsconfig` 基类时，不要把 `rootDir` / `outDir` / `include` / `exclude` 这类相对路径配置上提到基类文件；TypeScript 会按定义它们的配置文件位置解析，容易触发 `TS18003`。

## 2026-03-18 — package tsconfig 基类相对路径陷阱

- symptom: `pnpm ui:build` 在 `build-package-dists.mjs` 阶段失败，`tsc -p packages/design-tokens/tsconfig.json` 报 `TS18003: No inputs were found`，`include` 被解析成了 `../src`。
- root cause: 首版 `packages/tsconfig.base.json` 把 `rootDir` / `outDir` / `include` / `exclude` 一起上提到了共享基类；TypeScript 继承这些相对路径时，会按基类文件 `packages/tsconfig.base.json` 的位置解析，而不是按子包配置文件解析。
- what was tried: 先直接复查子包 `tsconfig.json` 文本，误以为 `include: [\"src\"]` 已足够；随后用 `pnpm exec tsc --showConfig -p packages/design-tokens/tsconfig.json` 检查实际展开结果，确认问题出在基类继承后的路径重写。
- fix/workaround: 共享基类只保留与包位置无关的编译选项（`target`、`module`、`strict` 等），把 `rootDir` / `outDir` / `include` / `exclude` 放回每个包自己的 `tsconfig.json`。
- prevention note: 以后做 TypeScript 配置去重时，凡是包含相对路径语义的字段，都先用 `tsc --showConfig` 验证展开结果，再把基类方案落到构建脚本上。
