# Bundle Budget Requirements

## Purpose

为 Web 端建立可执行的 bundle budget 要求，避免 UI foundation 收口后重新滑回“大单包、难维护、难定位”的状态。

读完本文件后，开发者应该能明确：

- 当前 bundle 问题在哪里
- 后续优化必须达到什么目标
- 需要怎样验证和阻断回归

## Current Baseline

基线来自 2026-03-18 最近一次 `pnpm build`：

| Chunk | Raw Size | Gzip Size | Note |
|------|----------|-----------|------|
| `dist/frontend/assets/index-*.js` | `764.37 kB` | `226.20 kB` | 当前最大问题，超过 Vite 默认告警阈值 |
| `AgentProfilePage-*.js` | `185.89 kB` | `25.30 kB` | 详情页偏重 |
| `AdminPanel-*.js` | `124.37 kB` | `18.11 kB` | 管理后台较重 |
| `ChatRoomPage-*.js` | `72.75 kB` | `11.30 kB` | 聊天室页有继续膨胀风险 |

结论：真正需要优先处理的不是“所有页面都大”，而是 `index-*.js` 过重，说明根入口吸入了过多非首屏逻辑。

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
  - 在 budget 机制落地前，PR 不得让当前最大 chunk 比最新基线更大。

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

## Implementation Guidance

- 优先检查 `src/frontend/app` 与路由入口，确认是否仍有过重的静态导入。
- 先做路由边界拆分，再做 `manualChunks`，不要反过来。
- 对重页面里的大对象常量、配置表、次级面板，优先考虑“页面内延迟加载”而不是继续挂在主入口。
- 不要为了缩包重新引入新的“全局单文件样式/脚本汇总层”。

## Verification

当前可执行检查：

```bash
pnpm build
```

检查要点：

- 记录 `dist/frontend/assets/index-*.js` 的 raw/gzip 体积
- 记录 top 5 route chunks
- 确认是否仍出现 Vite 的 `Some chunks are larger than 500 kB` 告警

后续 SHOULD 增加：

- 一个可脚本化的 bundle report 命令
- 一个可在 CI 中阻断回归的 budget check
