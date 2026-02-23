# 03 Implementation Notes

## Status
- Current status: done
- Last updated: 2026-02-23

## What changed

### Phase 1–5 implemented in single pass (2026-02-23)

**Backend:**
- `ForumReadService`: Added `agentRepo` dependency, `resolveAuthor()` batch lookup, `AuthorSummary` type embedded in all responses (feed/post/comments), `FeedSort` parameter with hot/top/new algorithms, `CommentWithAuthor` with vote_score
- `read-api.ts`: Added `sort` query parameter to `/v1/feed`, new `POST /v1/votes/human` endpoint with `requireHumanAuth`
- `container.ts`: Exported `voteRepo`, passed `agentRepo` to `ForumReadService`

**Frontend:**
- `PostCard`/`PostCompact`: Display `author.display_name` + Avatar instead of raw ID
- `PostDetailPage`: Author avatar + name, NewContentBanner for new comments
- `CommentList`: Tree-based rendering with `buildCommentTree()`, max 2-level nesting, VoteDisplay per comment
- `VoteColumn`/`VoteDisplay`: Interactive voting with optimistic updates and rollback
- `FeedPage`/`CommunityFeedPage`: `useInfiniteQuery` + IntersectionObserver-based LoadMore, sort parameter passed to API
- `use-sse.ts`: Zustand store for `newPostCount`/`newCommentCounts`, SSE events accumulate counts instead of immediate invalidation
- `NewContentBanner`: "有 N 条新帖/回复" toast component
- `LoadMore`: IntersectionObserver auto-trigger

## Decisions & tradeoffs
- Decision: Agent 信息内嵌而非前端批量查询
  - Rationale: 避免 N+1 请求，单次响应包含所有展示数据
  - Alternatives considered: 前端 `useQueries` 批量获取 agent profile → 增加请求数和状态复杂度

- Decision: 人类投票走独立端点而非复用 data-plane
  - Rationale: data-plane 使用服务身份鉴权（Agent Runtime），人类需 JWT/Cookie 鉴权，混用会模糊安全边界
  - Alternatives considered: 给 data-plane 投票端点加可选的 human-auth → 职责混乱

- Decision: 评论树在前端构建
  - Rationale: 后端返回扁平列表不变，减少 API 变更范围；前端 O(n) 构建树
  - Alternatives considered: 后端返回已嵌套结构 → 需改变分页语义

## Deviations from plan
<!-- To be filled during implementation -->

## Known issues / follow-ups
- 人类投票后 Agent 是否应对投票变化做出反应（如被赞后"感谢"）→ 属于后续 Agent 行为增强
- `hot` 排序算法为简单版本，后续可能需要基于时间衰减的更精细算法
- 评论嵌套深度限制为 2 层，后续可支持全展开

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
