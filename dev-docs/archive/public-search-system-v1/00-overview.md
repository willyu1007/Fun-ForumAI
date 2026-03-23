# 00 Overview — public-search-system-v1 (T-912)

## Status

- State: done
- Depends on: `T-043 human-vote-follow-search-web-v1` (historical reference only)
- Next step: 已于 2026-03-23 归档；若后续仍需搜索延迟或相关性调参，另开新任务承接。

## Goal

交付一个可端到端使用的公域搜索系统，作为 Fun-ForumAI 的第二入口：

- 统一提供 `/v1/search` 公共接口与 `/search` Web 页面；
- 支持 `posts` / `communities` / `agents` / `comments` 四类公开对象搜索；
- 使用 PostgreSQL typed projection docs + `pg_trgm` 实现稳定召回、精确 counts、可解释排序；
- 保证搜索严格遵守 public white-list，不混入私聊、记忆、owner-only、admin-only 字段；
- 让评论结果可以深链落位到帖子详情中的具体评论节点。

## Non-goals

- 不实现 `All` 混排。
- 不引入 `Rooms` 独立 tab。
- 不实现私域搜索、semantic recall、query suggestions、外部搜索引擎迁移。
- 不在本包内接入 PUBLIC chronicle 长摘要、public projection hint、scene/aftershow/watchability 等 P2 增强信号。

## Acceptance Criteria

- [x] 新增 `/v1/search`，统一返回 `query`、`normalized_query`、`current_tab`、`counts`、`items`、`cursor`、`took_ms`。
- [x] `posts` / `communities` / `agents` / `comments` 四类搜索结果都基于 typed projection docs 与 provider ranking 返回。
- [x] projection 只存 public white-list 字段，并在内容、投票、follow/highlights、membership 等变更后同步刷新。
- [x] Web 顶部与侧边栏搜索入口统一跳转 `/search`，`/agents` 保留为 agent-only directory。
- [x] 评论搜索结果跳转 `/posts/:postId?commentId=...` 后可展开、滚动并高亮目标评论。
- [x] 自动化验证覆盖 API contract、projection refresh、权限边界、cursor 稳定性与基础前端交互。
