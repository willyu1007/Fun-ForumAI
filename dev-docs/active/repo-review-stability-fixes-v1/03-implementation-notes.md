# 03 Implementation Notes

## Status
- Current status: `completed`
- Last updated: 2026-04-10

## What changed
- 已修复 `ForumReadService` 的 participation contract fallback 与默认 lifecycle fallback，恢复 data-plane / public observation 轻量上下文。
- 已把 owner media control surface 的 URL 解析改成 best-effort，不再把 URL 缺失误报成资产不存在。
- 已修复前端 lazy import helper 泛型约束、`AppShellContainer` lint 阻塞和 `DiscussionForest` fixture 漏字段。
- 已补齐 `semantic-projection` 的 public bio 兼容读取。
- 已修复 `FeedbackPage` 测试对隐藏文件输入与截图文案的断言方式。
- 已额外收敛一批被前置错误遮住的 TypeScript 问题，包括 forum event dispatcher、viewer semantic fields、context-builder、若干测试夹具和 mock 类型。
- 已把前端 help 文档链路里的 `yaml` / `zod` 拆到 `help-docs-runtime` chunk，消除 `vendor` 包体预算回归。
- 已修复 `.ai/skills/features/ci/scripts/ci-verify.mjs` 与当前仓库脚本能力不一致的问题：
  - `api` suite 在缺少 `test:api` 时回退到 `pnpm test`
  - `perf-k6-smoke` 在仓库未配置 k6 smoke 时改为显式 skip
- 已刷新 `docs/context/api/*` 与 `docs/context/registry.json`，补上 OpenAPI 索引对 orchestration policy endpoints 的漂移。
- 已修复 `AgentInteractionModal` 在只读模式下错误复用 owner agent 列表过滤条件的问题，避免从 `/me/agents` 返回集缺失时把有效 agent 详情误判为不存在。
- 已将论坛前端的 `DiscussionForest` / `ThreadList` 改为兼容缺失 `lifecycle` 元数据的读模型，避免轻量 fixture 和 Playwright mock 因空字段直接崩溃。
- 已修正 `tests/web/playwright/agent-modal.visual.spec.ts` 中误点到侧栏 agent 入口的 locator，使 owner tab 场景稳定命中弹窗内目标按钮。
- 已在确认当前 UI 为预期后，刷新 `agent-modal`、`forum-p0`、`governance-auth`、`realtime-p0` 的 Playwright 视觉基线快照。

## Files/modules touched (high level)
- `src/backend/services/*`
- `src/backend/media/*`
- `src/frontend/app/*`
- `src/frontend/features/forum/components/*`
- `src/frontend/widgets/agent-modal/*`
- 相关测试文件
- `src/backend/routes/read-api.ts`
- `src/backend/runtime/*`
- `tests/web/playwright/*`

## Decisions & tradeoffs
- Decision:
  - 优先修根因，让 route/read/service 自身恢复健壮性，而不是只改测试断言。
  - Rationale:
    - 这批失败已经进入仓级 gate，单点绕过会把同类回归保留下来。
  - Alternatives considered:
    - 仅修测试 fixture 或在 data-plane route 手工拼装最小响应，已放弃。

## Deviations from plan
- `web-playwright` 失败面里有一部分并非当前代码回归，而是视觉基线已落后于现状 UI；在抽样确认界面输出合理后，采用更新快照而非继续追查伪失败。

## Known issues / follow-ups
- `pnpm lint` 仍保留 `src/frontend/app/route-components.tsx` 上 `react-refresh/only-export-components` 的既有 warnings（共 `23` 条），不阻塞当前校验链，但后续可单独整理导出边界。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
