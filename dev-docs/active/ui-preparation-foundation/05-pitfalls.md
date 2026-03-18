# 05 Pitfalls — ui-preparation-foundation

（已解决的历史问题与“勿再犯”摘要；非当前 open issue。）

## do-not-repeat 摘要

- 2026-03-18：共享 `tsconfig` 基类时，不要把 `rootDir` / `outDir` / `include` / `exclude` 这类相对路径配置上提到基类文件；TypeScript 会按定义它们的配置文件位置解析，容易触发 `TS18003`。
- 2026-03-18：不要假设所有 `uix-*` key 都存在于 `uix-map.ts`；在做 bulk migration 之前必须先校验映射完整性。
- 2026-03-18：不要并行执行 `pnpm typecheck` 和 `pnpm build`；两者都会触发 `ui:build`，会争用 package `dist/` 生成链路。

## 2026-03-18 — package tsconfig 基类相对路径陷阱

- symptom: `pnpm ui:build` 在 `build-package-dists.mjs` 阶段失败，`tsc -p packages/design-tokens/tsconfig.json` 报 `TS18003: No inputs were found`，`include` 被解析成了 `../src`。
- root cause: 首版 `packages/tsconfig.base.json` 把 `rootDir` / `outDir` / `include` / `exclude` 一起上提到了共享基类；TypeScript 继承这些相对路径时，会按基类文件 `packages/tsconfig.base.json` 的位置解析，而不是按子包配置文件解析。
- what was tried: 先直接复查子包 `tsconfig.json` 文本，误以为 `include: [\"src\"]` 已足够；随后用 `pnpm exec tsc --showConfig -p packages/design-tokens/tsconfig.json` 检查实际展开结果，确认问题出在基类继承后的路径重写。
- fix/workaround: 共享基类只保留与包位置无关的编译选项（`target`、`module`、`strict` 等），把 `rootDir` / `outDir` / `include` / `exclude` 放回每个包自己的 `tsconfig.json`。
- prevention note: 以后做 TypeScript 配置去重时，凡是包含相对路径语义的字段，都先用 `tsc --showConfig` 验证展开结果，再把基类方案落到构建脚本上。

## 2026-03-18 — legacy uix key 可能存在漏映射

- symptom: 在执行 `uix('literal-key') -> class string` 的 bulk codemod 时，脚本在 `src/frontend/features/user/pages/SafetyCenterPage.tsx` 上失败，报 `Missing UIX map key uix-a10c4b5d31`。
- root cause: 历史 `uix` 体系并不严格保证“所有 key 都在 `uix-map.ts` 中有映射”；`uix.ts` 的实现允许漏映射时回退为原字符串 class 名，导致运行时可以“看起来没报错”，但样式来源已经失真。
- what was tried: 先按“所有 key 均可从 map 解析”的假设跑批量替换；失败后反查所有剩余 import 文件，只发现一个脏 key，并确认仓库内不存在其它定义该 class 的 CSS。
- fix/workaround: 对漏映射 key 不再保留原始 `uix-*` class 名，而是直接补成显式样式字符串；本例使用 `rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-950` 替换。
- prevention note: 以后移除 legacy key/value 映射工具前，先做一次“key 使用点 vs map 定义”完整性校验；不要把 `uix.ts` 的 fallback 当成正确样式来源。

## 2026-03-18 — `typecheck` / `build` 并行会互踩 `ui:build`

- symptom: 在同一轮里并行执行 `pnpm typecheck` 和 `pnpm build` 时，`pnpm build` 的 `build-package-dists.mjs` 阶段报 `TS2307`，提示 `@fun-forum/ui-contract` / `@fun-forum/design-tokens` 无法解析。
- root cause: `pnpm typecheck` 的 `pretypecheck` 和 `pnpm build` 的 `prebuild` 都会触发 `pnpm ui:build`；两条进程同时重建 package `dist/` 时，会短暂打断彼此的工作区包解析。
- what was tried: 初看像是 workspace package 导出回归，但复跑单独的 `pnpm typecheck` 已通过；将 `pnpm build` 改为串行重跑后也通过，确认问题来自并发执行而不是代码修改。
- fix/workaround: 对会触发 `ui:build` 的命令采用串行执行，至少在本地验证和 agent 自动化里不要并行跑。
- prevention note: 后续如果需要并发门禁，要么拆掉 `pretypecheck` / `prebuild` 对共享构建链路的重复触发，要么给 `ui:build` 增加锁/缓存机制，避免多个进程同时重建 `packages/*/dist`。
