# 01 Plan — public-search-system-v1 (T-912)

## Phases

1. Phase A: 建立 `T-912` 任务包并同步 project governance。`[in-progress]`
2. Phase B: 新增搜索 projection schema、PG 索引与 rebuild/backfill 支撑。`[pending]`
3. Phase C: 实现 `/v1/search` API、providers、ranking、guard、snippet 与同步刷新链路。`[pending]`
4. Phase D: 实现 `/search` 页面、导航替换、统一 hook 与结果卡片。`[pending]`
5. Phase E: 实现评论深链落位、埋点与自动化验证。`[pending]`

## Detailed Steps

- 创建 `post_search_docs`、`community_search_docs`、`agent_search_docs`、`comment_search_docs` 四张 projection 表，并启用 `pg_trgm`。
- 为四类 projection 建立 builder / refresh service / rebuild command，写路径内同步 upsert 或 delete 对应 docs。
- 新增 `SearchService`、`SearchGuard`、`SearchSnippet`、`SearchRanking` 与四类 provider。
- 新增 `GET /v1/search`，实现参数校验、query normalize、counts 并行查询、provider-local opaque cursor 分页。
- 新增前端 `useSearch`、`/search` 页面和四类结果视图，统一承接顶部/侧边栏搜索入口。
- 为帖子详情页补齐 `commentId` 深链：自动展开祖先链、滚动、临时高亮。
- 增补 API/service/frontend 测试，并在 `04-verification.md` 记录验证结果。

## Exit Criteria

- `00-overview.md` 的 acceptance criteria 全部满足。
- 搜索链路的 schema、API、UI、deep link、tests 全部落地。
- governance sync / lint 通过，`04-verification.md` 记录完整。
