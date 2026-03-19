# Bundle Budget Requirements

## Purpose

为 Web 端建立可执行的 bundle budget 要求，避免 UI foundation 收口后重新滑回“大单包、难维护、难定位”的状态。

读完本文件后，开发者应该能明确：

- 当前 bundle 问题在哪里
- 后续优化必须达到什么目标
- 需要怎样验证和阻断回归

## Historical Baseline

本需求启动前的最近一次实测基线来自 **2026-03-19** 的 `pnpm build`：

| Chunk | Raw Size | Gzip Size | Note |
|------|----------|-----------|------|
| `dist/frontend/assets/index-*.js` | `516.87 kB` | `163.86 kB` | 仍高于目标；当时距离 hard target 还差 `16.87 kB raw / 13.86 kB gzip` |
| `AgentProfilePage-*.js` | `73.15 kB` | `18.91 kB` | 路由级懒加载已生效 |
| `AdminPanel-*.js` | `55.90 kB` | `14.26 kB` | 管理后台为重页面但仍在可控范围 |
| `ChatRoomPage-*.js` | `31.86 kB` | `9.13 kB` | 主要风险已从页面级转到入口共享依赖 |

结论：此时真正需要优先处理的已经不是“重页面没有拆开”，而是 **根壳层共享依赖和默认 vendor 合包** 让 `index-*.js` 仍然过重。

## Landed Mechanism

本需求现已落地为以下 repo 内机制：

- `vite.config.ts`
  - 显式定义 `manualChunks`
  - 构建时生成 `dist/frontend/bundle-report.json`
- `ui/config/bundle-budget.json`
  - 存放 hard budget、warn budget、异步重路由约束、chunk group 规则，以及 `reportPath` / `baselinePath` 这类默认读写路径
- `ui/config/bundle-baseline.json`
  - 存放当前接受的 top chunks 基线
- `scripts/ui/report-bundle-budget.mjs`
  - 打印 top chunks、baseline、delta
- `scripts/ui/check-bundle-budget.mjs`
  - 阻断 hard regression
- `scripts/ui/accept-bundle-baseline.mjs`
  - 从最新 build report 刷新机器基线

当前接受的机器基线以 `ui/config/bundle-baseline.json` 为准，而不是手工抄写在本文档里的 hash 文件名。
`pnpm ui:bundle:accept` / `report` / `check` 默认都会先读取 `ui/config/bundle-budget.json`，再按其中的路径字段定位 report 与 baseline；只有显式传入 `--report-file` / `--baseline-file` 时才覆盖。

## Goals

- 将根入口重新收口为“只承载 app shell + routing + 必要 runtime”的体量。
- 让重页面和重功能按路由或职责边界拆分，而不是继续堆在主入口。
- 为后续 UI 迭代建立明确的回归门槛。

## In Scope

- Web 前端 `vite` 分包策略
- 路由级懒加载边界
- vendor chunk / feature chunk 拆分
- bundle 报表与门禁

## Out Of Scope

- 不在本需求里改 API、数据库或业务流程
- 不要求为了缩包重写产品逻辑
- 不覆盖 mobile 包体优化

## Requirements

### MUST

- MUST 把 `dist/frontend/assets/index-*.js` 作为第一优先级优化对象。
- MUST 保证根入口不直接吸入 admin、agent detail/manage、private chat、chat room、post detail 这类重页面逻辑。
- MUST 对重路由建立稳定的异步边界，至少覆盖：
  - `AgentProfilePage`
  - `AgentManagePage`
  - `AdminPanel`
  - `ChatRoomPage`
  - `PostDetailPage`
  - `PrivateChatPage`
- MUST 为 bundle 检查保留可重复的基线记录，至少能从 `pnpm build` 输出中提取 top chunks。
- MUST 在后续优化完成后，把根入口目标压到：
  - `<= 500 kB` raw
  - `<= 150 kB` gzip
- MUST 设定“未达最终目标前不得继续恶化”的约束：
  - PR 不得让当前最大 JS chunk 比 `ui/config/bundle-baseline.json` 中接受的基线更大。
- MUST 在 CI 中把 budget check 作为阻断式门禁，而不是仅靠 Vite 的 500 kB warning。
- MUST 校验以下 6 个重路由继续保有异步边界：
  - `AgentProfilePage`
  - `AgentManagePage`
  - `AdminPanel`
  - `ChatRoomPage`
  - `PostDetailPage`
  - `PrivateChatPage`

### SHOULD

- SHOULD 在 `vite.config.ts` 中显式定义 `manualChunks`，避免分包结果完全依赖默认启发式。
- SHOULD 把高复用 vendor 与页面级 feature chunk 分开观察，例如：
  - React / router runtime
  - query/data cache runtime
  - Radix / UI layer
  - admin / chat / forum heavy routes
- SHOULD 为 bundle 结果增加机器可读输出，避免只靠人工看终端日志。
- SHOULD 在 CI 中把 bundle regression 变成可见门禁，而不是仅靠 Vite 警告。

### MAY

- MAY 在预算未稳定前先设置分阶段目标：
  - Phase A：先阻止继续变大
  - Phase B：完成入口拆分
  - Phase C：压缩重页面 chunk

## Acceptance Criteria

- `pnpm build` 通过。
- 根入口 chunk 满足 `<= 500 kB raw / <= 150 kB gzip`。
- 常规用户路由 chunk SHOULD 控制在 `<= 150 kB raw`。
- 管理后台或高度复杂页面 MAY 放宽，但 SHOULD 控制在 `<= 200 kB raw`。
- PR 中能明确看到当前 top chunks 与上一次基线的对比。
- `pnpm ui:bundle:check` 在 hard regression 时返回非零退出码。

## Implementation Guidance

- 优先检查 `src/frontend/app` 与路由入口，确认是否仍有过重的静态导入。
- 先做路由边界拆分，再做 `manualChunks`，不要反过来。
- 对重页面里的大对象常量、配置表、次级面板，优先考虑“页面内延迟加载”而不是继续挂在主入口。
- 不要为了缩包重新引入新的“全局单文件样式/脚本汇总层”。
- 根壳层路径（如 `Layout`、`LeftSidebar`、`RightSidebar`、`AgentPanel`）不要依赖 `@/api/hooks` 这种 barrel import，避免后续 export 面膨胀时无意拉大 root entry。

## Verification

当前标准检查链路：

```bash
pnpm build
pnpm ui:bundle:report
pnpm ui:bundle:check
```

检查要点：

- `dist/frontend/bundle-report.json` 已生成
- `pnpm ui:bundle:report` 能输出当前 top JS chunks、基线值、delta
- `pnpm ui:bundle:check` 在 hard regression 时阻断
- CI `check` job 会上传 `frontend-bundle-report` artifact

刷新基线：

```bash
pnpm ui:bundle:accept
```

说明：

- `pnpm ui:bundle:accept` 只应在确认新的 chunk 结果是“可接受的新基线”后执行。
- 若只想验证失败路径，可传自定义 budget 文件给 `pnpm ui:bundle:check -- --budget-file <path>`。
