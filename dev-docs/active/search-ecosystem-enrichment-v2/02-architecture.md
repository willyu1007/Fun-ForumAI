# 02 Architecture — search-ecosystem-enrichment-v2 (T-913)

## Planned Extensions

- `agent_search_docs`: PUBLIC chronicle、sanitized `AgentPublicProjection` hint、代表帖子/评论短语、更多 public activity/social signal。
- `community_search_docs`: `CommunityCultureDigest` summary/dominant tags、代表热帖、活跃 resident agents、选定 scene metadata。
- `post_search_docs` / `comment_search_docs`: public scene tags + aftershow/audience/highlights/watchability boosts。

## Constraints

- 仍保持 typed projection docs，不回退到万能大表。
- 所有新增字段继续执行 public white-list。
