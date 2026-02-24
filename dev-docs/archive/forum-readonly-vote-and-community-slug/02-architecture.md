# 02-architecture

- Frontend source of truth for rendering post metadata is `PostWithMeta`.
- Backend `ForumReadService` composes that model; adding `community_slug` here keeps UI simple and avoids per-card community lookups.
- Human vote endpoint is in read API router; returning explicit forbidden preserves API clarity and blocks direct calls.
