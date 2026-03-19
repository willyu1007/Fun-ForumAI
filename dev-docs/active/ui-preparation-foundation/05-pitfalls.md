# 05 Pitfalls — ui-preparation-foundation

（已解决的历史问题与“勿再犯”摘要；非当前 open issue。）

## do-not-repeat 摘要

- 2026-03-18：共享 `tsconfig` 基类时，不要把 `rootDir` / `outDir` / `include` / `exclude` 这类相对路径配置上提到基类文件；TypeScript 会按定义它们的配置文件位置解析，容易触发 `TS18003`。
- 2026-03-18：不要假设所有 `uix-*` key 都存在于 `uix-map.ts`；在做 bulk migration 之前必须先校验映射完整性。
- 2026-03-18：不要并行执行 `pnpm typecheck`、`pnpm build`、`pnpm ui:check` 这类会触发 UI package 构建链路的命令；它们会争用 `packages/*/dist`，造成瞬时 `TS2307` 假失败。
- 2026-03-18：Playwright 里不要用模糊文案去点按钮；`创建` 会匹配到 `引导式创建`，必须加 `exact: true` 并 scope 到表单容器。
- 2026-03-18：pnpm root workspace 加依赖时，如果当前 `node_modules` 来自旧 store，`pnpm add` 可能直接报 `ERR_PNPM_UNEXPECTED_STORE`；先改 `package.json`，再用 `pnpm install --force` 重建链接。
- 2026-03-18：Playwright 默认截图名会带平台后缀；如果 baseline 要在 macOS 本地和 Linux CI 共享，必须显式覆盖 `snapshotPathTemplate`，否则会同时生成 `-darwin` / `-linux` 两套文件。
- 2026-03-18：仓库级 alias/helper 文件如果会被 ESM 配置直接加载，不要写 `__dirname`；统一改用 `import.meta.url + fileURLToPath()`。
- 2026-03-18：Playwright mock data 不要自己手搓宽泛对象类型；直接引用前端 API DTO，避免 fixture shape 慢慢漂离真实页面契约。
- 2026-03-19：配置文件里声明了路径字段，就必须让构建插件和 CLI 默认链路都真正消费这些字段；不要一边加 `reportPath` / `baselinePath`，一边在脚本里保留第二套硬编码默认值。
- 2026-03-19：NodeNext 配置层文件不仅要写显式 `.js` 扩展名，还要把被 import 的 helper 文件纳入 `tsconfig.node.json.include`；否则 `tsc -b` 会报 `TS6307`。
- 2026-03-19：Playwright 截图前必须主动把 document 和 `app-shell-content` 的 scroll 归零；不要假设单跑通过就代表全量 suite 不会带着滚动位置截图。
- 2026-03-19：对高文本密度 split-pane 页面，优先使用“单页局部、有限度”的 screenshot tolerance；不要因为一张图有栅格噪声就放宽全局 visual threshold。
- 2026-03-19：不要再按历史 `Tailwind B1-layout-only` 理解当前仓库治理策略；repo 现行策略是 `semantic-token-guarded`。任何策略调整都必须同步 `ui/config/governance.json`、`docs/context/ui/ui-spec.json`、`ui-governance-gate` skill 文档和 approval 指纹。
- 2026-03-19：不要把“Python gate 已通过离线审计”误写成“它已经是 active CI merge gate”；当前 CI 仍只跑 `lint + ui:check + ui:bundle:check + Playwright`，Python gate 还没接线。

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

- symptom: 在同一轮里并行执行 `pnpm typecheck`、`pnpm build` 或 `pnpm ui:check` 时，某条命令会在 `build-package-dists.mjs` 阶段报 `TS2307`，提示 `@fun-forum/ui-contract` / `@fun-forum/design-tokens` / `@fun-forum/design-tokens/mobile-theme` 无法解析。
- root cause: `pretypecheck`、`prebuild`、`preui:check` 都会触发同一套 UI package build；多条进程同时重建 package `dist/` 时，会短暂打断彼此的工作区包解析。
- what was tried: 初看像是 workspace package 导出回归，但改为串行重跑 `pnpm ui:check` / `pnpm typecheck` 后立即恢复，确认问题来自并发执行而不是代码修改。
- fix/workaround: 对会触发 `ui:build` 的命令采用串行执行，至少在本地验证和 agent 自动化里不要并行跑。
- prevention note: 后续如果需要并发门禁，要么拆掉 `pretypecheck` / `prebuild` / `preui:check` 对共享构建链路的重复触发，要么给 `ui:build` 增加锁/缓存机制，避免多个进程同时重建 `packages/*/dist`。

## 2026-03-19 — 治理策略变更不能只改一处配置

- symptom: 首轮 `ui-governance-gate` reassessment 报出成千上万条 Tailwind 违规，看起来像 repo 大面积失控，但 Node gate、Playwright 和页面实际样式并没有同等规模回归。
- root cause: Python gate 仍在按历史 `B1-layout-only` 审计，而仓库已经转向 token 驱动的语义 class 体系；治理脚本、配置、文档真源和 approvals 没有一起升级，导致“策略过期”被误报成“代码回归”。
- what was tried: 先把真正的 raw palette 残留收掉，再对比 `ui/config/governance.json`、`docs/context/ui/ui-spec.json`、`ui-governance-gate` 脚本与 skill 文档，确认问题出在策略真源分叉，而不是单个页面。
- fix/workaround: 将治理策略整体收口到 `semantic-token-guarded`，同步更新 Python gate、UI spec、governance config、skill 文档，并补齐新的 `exception` / `spec_change` approvals；随后 full run `.ai/.tmp/ui/20260319T050955Z-48487/` 已 `errors=0`。
- prevention note: 以后只要 UI 治理策略升级，必须把“配置 + 审计脚本 + 文档 + approvals”当成一组原子变更；不要只改一处配置文件，然后等 gate 以旧策略误杀整个仓库。

## 2026-03-18 — Playwright 文案选择器容易误点同前缀按钮

- symptom: `AgentManagePage` 的视觉用例里，`getByRole('button', { name: '创建' })` 在三端都报 strict mode violation，因为页面同时存在 `引导式创建` 和 `创建`。
- root cause: Playwright 的 accessible name 匹配默认不是“整词按钮语义”，而是按 name 命中多个符合条件的元素；中文前缀重合时尤为容易踩中。
- what was tried: 先直接用全局 role + name 选按钮，导致 mutation error / create success 两个用例都在点击前失败。
- fix/workaround: 改为 `page.getByTestId('agent-manage-form').getByRole('button', { name: '创建', exact: true })`，同时做容器 scope 和 exact match。
- prevention note: 后续写 Playwright 用例时，凡是按钮文案存在前后缀重叠，都优先用 test id 范围缩小后再做 exact 文案匹配。

## 2026-03-18 — pnpm store 漂移会阻断 root workspace 加依赖

- symptom: 执行 `pnpm add -Dw @playwright/test` 时，pnpm 报 `ERR_PNPM_UNEXPECTED_STORE`，提示现有 `node_modules` 仍链接到旧用户目录下的 store。
- root cause: 本地工作区曾由另一套 pnpm store 链接生成；在 root workspace 追加依赖时，pnpm 会先校验 store 一致性，发现不一致就拒绝继续修改 lock / node_modules。
- what was tried: 先用 `pnpm add -Dw` 直接安装，随后检查旧 store 路径是否存在，确认并不是依赖本身的问题，而是现有 `node_modules` 的链接来源已漂移。
- fix/workaround: 手动更新 `package.json` 后执行 `pnpm install --no-frozen-lockfile --force`，重建整棵 workspace 的链接并同步 lockfile。
- prevention note: 以后在本地接入新依赖前，如果 repo 来自其它机器/用户的现成 `node_modules`，优先先做一次 `pnpm install --force`，不要直接在脏链接状态下跑 `pnpm add`。

## 2026-03-18 — 默认 snapshot 命名会把本地和 CI baseline 拆成两套

- symptom: 首轮 Playwright baseline 在本机生成后，快照文件名全部带 `-darwin`；如果直接把这套提交到仓库，GitHub Actions 上的 Linux runner 会寻找 `-linux` 文件并报“快照不存在”。
- root cause: Playwright 默认 snapshot 命名会把平台信息拼进文件名，适合多平台分别维护快照，但不适合“同一套 Chromium baseline 同时服务本地与 Ubuntu CI”的策略。
- what was tried: 先按默认配置生成 baseline，随后检查快照目录，确认所有文件都带 `-darwin`，说明 CI 无法直接复用。
- fix/workaround: 在 `playwright.config.mjs` 中显式设置 `snapshotPathTemplate`，只保留 `{arg}-{projectName}{ext}`，去掉平台后缀；重新生成 baseline 后，再删除旧的 `*-darwin.png`。
- prevention note: 以后接入新的视觉回归仓库时，先决定“是否允许平台分叉 baseline”；如果答案是否定的，就在第一次生成快照前先把命名模板定死。

## 2026-03-18 — ESM 配置上下文里不要继续假设 `__dirname`

- symptom: `workspace-package-aliases.ts` 在配置/工具链上下文里需要直接解析仓库绝对路径；如果沿用 CommonJS 风格的 `__dirname`，ESM 加载链路会在 fresh install、preview 或 CI 环境里变得不稳定。
- root cause: 这类 helper 虽然是 TypeScript 文件，但它服务的是 Vite/Vitest 一类 ESM 配置执行环境；`__dirname` 不是可靠前提。
- what was tried: 先沿用常规 Node 路径拼接写法，随后在代码质量复核里重新检查“哪些文件会被配置层直接 import”，确认该文件属于 ESM 运行时敏感区。
- fix/workaround: 统一改成 `const ROOT = path.dirname(fileURLToPath(import.meta.url))`，再从 `ROOT` 做 `path.resolve(...)`。
- prevention note: 以后凡是给 Vite、Vitest、Playwright、脚本入口复用的路径 helper，一律优先按 ESM 写法处理，不要等到 CI 才发现运行时差异。

## 2026-03-18 — Playwright fixture 必须直接绑定真实 API DTO

- symptom: 首版视觉回归 mock data factory 大量使用宽泛对象和 `Record<string, unknown>` 容器，短期可跑，但一旦页面消费字段变化，测试会更容易出现“看起来通过、实际契约已漂移”的假稳定。
- root cause: fixture 层没有复用前端 `src/frontend/api/*` 的现成类型，导致 mock shape 与页面真实数据契约之间缺少编译期约束。
- what was tried: 先用手写对象把 pilot 页面跑通；在代码质量复核时回看 helper 和 builder，确认这里是后续扩面时最容易积累隐性漂移的位置。
- fix/workaround: `mock-data.ts` 与 `helpers.ts` 直接 import `UserProfile`、`Agent`、`Community`、`Notification`、`OwnerLifeOverview` 等 DTO，让 builder 和 common mocks 都受真实类型约束。
- prevention note: 后续新增视觉页时，mock 层默认先找现成 API 类型；只有在仓库中没有稳定 DTO 时，才允许局部自定义测试类型。

## 2026-03-19 — bundle budget 路径配置不能只做“名义 SSOT”

- symptom: `ui/config/bundle-budget.json` 已声明 `reportPath` / `baselinePath`，但首版实现里 CLI 仍默认回退到硬编码路径，Vite plugin 写 report 时也把配置路径压成了 `basename(...)`；只要后续有人改配置文件路径，脚本与构建产物就会静默失配。
- root cause: 首版 bundle budget 只把“预算数字和 chunk 规则”收口到了配置文件，却没有把“路径解析默认值”一并收口；结果形成了配置文件与脚本实现两套真源。
- what was tried: 先用 review 直接比对配置与脚本实现，随后构造 `/tmp` 临时 budget，把 `reportPath` / `baselinePath` 都改成自定义位置，分别复跑 `ui:bundle:accept`、`report`、`check` 验证实际读写路径。
- fix/workaround: `scripts/ui/bundle-budget-lib.mjs` 改为先读取 budget 配置，再以 `reportPath` / `baselinePath` 作为 CLI 默认值；`vite.config.ts` 改为按完整 `reportPath` 写盘；错误输出也引用实际 report 路径。
- prevention note: 以后给 repo-tracked 配置增加“文件路径类字段”时，不只检查主逻辑是否读取该字段，还要构造一组非默认路径的验证用例，确认 build、accept、check、report 都会随配置移动。

## 2026-03-19 — NodeNext 配置链路不能漏掉 helper 文件

- symptom: `pnpm typecheck` 在 `tsc -b` 阶段报 `TS6307`，指出 `workspace-package-aliases.ts` 没有被 `tsconfig.node.json` 纳入项目；同时 `vite.config.ts` / `vitest.config.ts` 还会因为相对 import 缺失 `.js` 扩展名和 `rollup` 类型依赖而报错。
- root cause: Vite/Vitest 配置已经切到 NodeNext/ESM 语义，但类型配置仍把“会被配置层 import 的 helper”视为项目外文件；同时沿用了更接近 bundler 语义的 import 写法。
- what was tried: 先直接修 `vite.config.ts` / `vitest.config.ts` 的 import 路径，再跑 `pnpm typecheck`；随后根据 `TS6307` 报错把 `workspace-package-aliases.ts` 纳入 `tsconfig.node.json.include`，并把 `vite.config.ts` 内部的 bundle output 类型改为本地结构类型，去掉对 `rollup` 类型包的隐式依赖。
- fix/workaround: 配置层统一使用：
  - 显式 `.js` 扩展名
  - `import.meta.url + fileURLToPath()` 解析 ROOT
  - `tsconfig.node.json` 显式 include 所有会被配置文件 import 的 TS helper
- prevention note: 后续只要有 TS 文件被 `vite.config.ts` / `vitest.config.ts` / 其他 NodeNext 配置直接 import，就把它视为“配置项目的一部分”，不要等 `tsc -b` 报 `TS6307` 才补 include。

## 2026-03-19 — visual helper 不主动归零 scroll 会在全量 suite 里抖动

- symptom: `realtime-room-detail-members-rail` 在单独更新基线时可通过，但全量 `pnpm test:e2e:playwright` 偶发出现顶部 header 或内容区位置偏移，导致截图 diff。
- root cause: `expectPageSnapshot()` 只负责注入稳定样式和等待字体，没有在截图前把 document / shell content 的 scroll 位置归零；当某些页面或组件在测试里触发滚动后，后续截图会继承非零 scroll。
- what was tried: 先直接查看 diff/expected/actual 图，确认变化集中在同一页面结构的整体位移而不是业务内容变化；随后在 helper 中同时重置 `window.scrollTo(0, 0)`、`documentElement.scrollTop`、`body.scrollTop` 和 `[data-testid="app-shell-content"]` 的滚动值。
- fix/workaround: `tests/web/playwright/support/helpers.ts` 的 `expectPageSnapshot()` 现在会在截图前统一归零滚动，并等待一帧后再执行 `toHaveScreenshot()`。
- prevention note: 后续新增带内部滚动容器的页面时，不要把“截图前稳定化”只理解为停动画和等字体；滚动位置同样是必须显式重置的状态。

## 2026-03-19 — 私聊线程页的渲染噪声要局部收口，不要放宽全局阈值

- symptom: `realtime-private-chat-thread` 在单独跑 `realtime-p0.visual.spec.ts` 时稳定，但在全量 168-case suite 里会出现 1%–3% 的像素差异；diff 图显示结构未变，主要是高文本密度 split-pane 页面上的边缘/字形栅格噪声。
- root cause: 私聊线程页同时包含左侧会话列表、右侧消息流和输入区，文本、边框与 placeholder 非常密集；在全量并发截图时，Chromium 对该页的局部栅格化比其它页面更敏感。
- what was tried: 先重新接受整组 `realtime` baseline，再单独与全量交叉复跑；确认问题只集中在 `realtime-private-chat-thread`，且 diff 一直低于 20k pixels，说明不是布局或数据层回归。
- fix/workaround: `expectPageSnapshot()` 增加可选 `maxDiffPixels` 参数，并仅在 `realtime-private-chat-thread` 这一张图上设置 `20_000` 的 bounded 容差；其它页面继续保持默认严格阈值。
- prevention note: 后续如果又遇到类似“单页有稳定噪声、全局其余页面稳定”的情况，优先做单图局部容差或进一步拆分截图范围；不要因为一页抖动就放宽整个 suite 的门槛。
