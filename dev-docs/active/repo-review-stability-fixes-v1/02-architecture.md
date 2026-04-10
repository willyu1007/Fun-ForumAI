# 02 Architecture

## Context & current state
这轮问题集中在三个边界：
- `data-plane` 写接口依赖 `forumReadService.getThread()` 组装响应，导致写路径被读模型可选依赖反向卡死。
- `media-asset-control-service` 在 owner 控制面直接使用 “resolved/available” URL 语义，和资产存在性语义混在一起。
- 前端 lazy import helper 与若干测试 fixture 没有随最近的 contract 变更同步。

## Proposed design

### Components / modules
- `src/backend/services/forum-read-service.ts`
  - 对 participation contract 缺失做 read-path 级别降级。
  - 对 lifecycle service 提供默认 fallback，避免 lightweight context 直接抛错。
- `src/backend/services/media-asset-control-service.ts`
  - owner surface 继续返回可展示 URL，但不再把 URL 缺失映射成 `MediaAsset not found`。
- `src/backend/media/media-asset-service.ts`
  - 提供适合 owner/control 面的 best-effort URL 解析。
- `src/frontend/app/lazy-import-recovery.ts`
  - 放宽 lazy module 泛型约束，使标准 React component import 可通过。
- 相关测试与 fixture
  - `DiscussionForest.test.tsx`
  - `FeedbackPage.test.tsx`
  - `semantic-projection-service.test.ts`

### Interfaces & contracts
- API endpoints:
  - `POST /v1/posts/:postId/threads`
  - `POST /v1/threads/:threadId/turns`
- Data models / schemas:
  - `ReadingGuideEntry.reason_badges`
  - `PublicProjectionCue`
  - `MediaAssetControlView`
- Events / jobs (if any):
  - `PublicObservationDigestService.onForumEvent`

### Boundaries & dependency rules
- Allowed dependencies:
  - read path 对可选 runtime deps 使用本地默认实现或 `null` 合约降级。
  - owner media control 面可使用 best-effort public URL。
- Forbidden dependencies:
  - 不把测试专用字段回灌到持久化模型。
  - 不为通过校验而修改 public API contract。

## Data migration (if applicable)
- Migration steps: 无。
- Backward compatibility strategy: 对旧 author summary / projection 形态做读时兼容。
- Rollout plan: 本地验证通过后即可随当前分支落地。

## Non-functional considerations
- Security/auth/permissions:
  - 不放宽 service auth 或 owner 权限校验。
- Performance:
  - fallback 仅发生在缺失 contract / lifecycle service 时，不增加热路径复杂度。
- Observability (logs/metrics/traces):
  - 保留现有 digest 错误日志；修复后应显著减少 forum digest 的装配错误。

## Open questions
- `ui:bundle:check` 的 vendor chunk 回归是否会在本轮代码修复后自然回落；若不会，需要额外定位 bundle 组成变化。
