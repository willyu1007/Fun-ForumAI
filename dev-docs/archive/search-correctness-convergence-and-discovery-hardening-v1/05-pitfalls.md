# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)

- 搜索修复不能只改返回层；必须同时检查 projection build、searchable_text、guard、count 和 UI 渲染。
- `/v1/search` 只能 additive upgrade，不能删除旧字段或改现有字段语义。
- `/v1/agents` 兼容层不得重新实现第二套 agent 搜索语义。

## Pitfall log (append-only)

### 2026-03-23 - Task bundle bootstrap
- Symptom:
  - 搜索修复任务跨 backend/frontend/dev-docs/admin runtime，多条实现线并行，容易在没有持续上下文的情况下漂移。
- Context:
  - 该任务明确满足 `dev-docs` complex-task gate。
- What we tried:
  - 在编码前先建立完整 bundle，并把产品口径固化到 decisions / architecture / verification。
- Why it failed (or current hypothesis):
  - N/A
- Fix / workaround (if any):
  - 保留 repo 标准 bundle，同时补搜索专项文档，避免后续上下文丢失。
- Prevention (how to avoid repeating it):
  - 后续每阶段完成后更新 `03-implementation-notes.md` 与 `04-verification.md`。
- References (paths/commands/log keywords):
  - `dev-docs/AGENTS.md`
  - `dev-docs/active/search-correctness-convergence-and-discovery-hardening-v1/*`

### 2026-03-27 - Top bar search empty-state requests can poison unrelated UI regression runs
- Symptom:
  - UI governance gate / Playwright 在 governance、forum、realtime 等并非 search 页的场景里大面积飘红，表现为页面数据未完全收敛、视觉基线在 mobile / tablet 上一起变化。
- Context:
  - `2c2306a` 把 inline search dropdown 挂到了全站 shell 顶部栏。
- What we tried:
  - 先排查视觉 diff；再对照 `TopBarSearch` 代码发现 `useSearch(undefined)` 在 query 为空时依然会执行，两条 `/v1/search` 请求会在所有页面挂载时偷偷发出。
- Why it failed (or current hypothesis):
  - 顶部栏把“blank discovery 只在搜索交互时需要”的查询，错误地变成了“全站 mount 即触发”的副作用，污染了视觉回归的时序与基线。
- Fix / workaround (if any):
  - 为 `useSearch()` 增加显式 `enabled` 选项；`TopBarSearch` 改为仅在 dropdown 打开且需要 discovery / suggestions 时启用查询。
- Prevention (how to avoid repeating it):
  - Shell 级组件里所有数据查询都必须明确区分“挂载即取”与“交互后取”；对 autocomplete / discovery 类场景，不要再把 `undefined params` 当成“自动允许空查询”。
- References (paths/commands/log keywords):
  - `src/frontend/api/hooks/forum.ts`
  - `src/frontend/widgets/shell/TopBarSearch.tsx`
  - `.ai/.tmp/ui/20260327T001617Z-53879/ui-gate-report.md`

### 2026-03-27 - Search agent rows must not expose duplicate same-name buttons
- Symptom:
  - `tests/web/playwright/agent-modal.visual.spec.ts` 在 `getByRole('button', { name: '<agent-name>' })` 上直接触发 strict-mode violation。
- Context:
  - 新版 search agent row 同时让头像和名字都成为 `AgentLink` button，且可访问名称相同。
- What we tried:
  - 查看 Playwright trace / error log 后，把重复交互目标收敛到单一名称按钮。
- Why it failed (or current hypothesis):
  - “整行可点击”改版后没有同步收敛子元素的交互职责，导致同一语义目标暴露出两个可聚焦 button。
- Fix / workaround (if any):
  - 保留名称 `AgentLink`，移除头像按钮，继续用 row click 承担整行打开 modal 的行为。
- Prevention (how to avoid repeating it):
  - 列表行改成 whole-row click 时，必须同步审查子元素是否还保留重复的 button/link 语义，尤其是 avatar + title 这种常见重复目标。
- References (paths/commands/log keywords):
  - `src/frontend/features/search/pages/SearchPage.tsx`
  - `tests/web/playwright/agent-modal.visual.spec.ts`

### 2026-03-27 - Avatar asset packs must not include unreferenced alternates
- Symptom:
  - `2c2306a` 一次性引入了 32 张 PNG 社区头像，但 `PRESET_AVATARS` 只消费其中 16 张，另外 16 张长期留在 `public/community-avatars/` 中，形成静态废文件。
- Context:
  - 这批资源和社区 preset avatar 系统一起提交，视觉上看似“都有用”，但真实映射只指向每组的一张图。
- What we tried:
  - 先枚举 `PRESET_AVATARS`，再反查整个 repo 对新增文件名的引用，确认另一半资源完全未被代码、测试或文档使用。
- Why it failed (or current hypothesis):
  - 资源导入时没有要求“素材清单”和“运行时映射”一一对应，导致设计备选稿直接进入了正式仓库。
- Fix / workaround (if any):
  - 删除未被消费的 16 张 PNG 备选资源，并把社区头像测试断言同步到实际使用的 `.png` 格式。
- Prevention (how to avoid repeating it):
  - UI 资源批量入仓前，必须同时核对“目录文件数”和“真实映射表/消费点”；未进入映射的备选稿不要直接放进 `public/`。
- References (paths/commands/log keywords):
  - `src/frontend/shared/utils/community-shell-meta.ts`
  - `public/community-avatars/*`
  - `rg -n "comm-avatar-(...)" -S .`

### 2026-03-28 - UI gate will reject helper components that pass Tailwind classes as opaque strings
- Symptom:
  - `ui-governance-gate` 对 `SearchPage.tsx` 报 `tailwind-policy-unparseable`，即使实际 className 内容是合法的 layout / semantic token 组合。
- Context:
  - 为了复用 post/thread 作者入口，初版 `SearchAgentIdentity` helper 把 `avatarClassName`、`nameClassName` 等 Tailwind 字符串作为 props 传入，再在组件内部透传。
- What we tried:
  - 先保留 helper 结构，只通过 props 传递不同 className。
- Why it failed (or current hypothesis):
  - gate 的静态分析要求 className 由显式字符串字面量组成；把整串 class 作为 opaque prop 传递后，分析器无法判断是否合法。
- Fix / workaround (if any):
  - 把 helper 收敛成固定字面量 class；如果需要变体，使用显式枚举/分支，而不是任意字符串 props。
- Prevention (how to avoid repeating it):
  - 在受 UI gate 约束的组件里，不要设计“任意 className 字符串透传”的样式 helper；优先用固定字面量或有限 variant。
- References (paths/commands/log keywords):
  - `src/frontend/features/search/pages/SearchPage.tsx`
  - `.ai/.tmp/ui/20260328T154222Z-74094/ui-gate-report.md`
