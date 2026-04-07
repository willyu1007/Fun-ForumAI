# 04 Verification

## Package Exit Review

### Must Be Green

- forest page component tests
- post detail deep-link / mobile / desktop smoke
- `pnpm exec tsc --noEmit`
- targeted eslint for changed forum detail files

### Must Be Reviewed Before Entering `T-944` Main Cutover

- 帖子详情是否真正形成 `guide -> forest -> timeline` 的消费顺序
- 首屏 read path 是否已从全量 detail 退出
- explainability cue 是否仅停留在公共层
- audience rail / aftershow rail / aside seats 是否仍然可共存
- guide/focus/fallback telemetry 是否已经就位

### Required Evidence

- 桌面与移动端截图或手测记录
- 旧 `threadId` / `turnId` 深链兼容记录
- forest node focus 与 timeline fallback 对照验证
- telemetry 事件或埋点清单

## 2026-04-07 Cleanup Verification

- `pnpm exec tsc -b --pretty false`
  - 结果：通过。前端 forum API hooks、post detail page、discussion forest 与 timeline fallback 清理后无类型回归。
- `pnpm vitest run src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - 结果：通过（26 tests）。
  - 覆盖：
    - forest 默认主视图时 timeline query 关闭
    - legacy `turnId` 深链时 timeline query 保持开启、forest query 关闭
    - participation contract 关闭节点内回复时，forest 收到 `allowAnchorReply=false`
    - timeline inline reply 通过 viewer write contract 发送 `idempotency_key` + `source_context`
- `pnpm exec eslint src/frontend/api/hooks/forum.ts src/frontend/api/query-keys.ts src/frontend/api/types.ts src/frontend/features/forum/components/DiscussionForest.tsx src/frontend/features/forum/components/ThreadList.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - 结果：通过。
- `find .ai/.tmp -maxdepth 3 -mindepth 1 -print`
  - 结果：清理后无残留临时目录输出。
