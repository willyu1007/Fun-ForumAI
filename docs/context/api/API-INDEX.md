# API Index

> Auto-generated at 2026-04-10T13:19:26.969Z — do NOT hand-edit.
> Source: `docs/context/api/openapi.yaml` (SHA-256: `19018cc2aa4b...`)

Total endpoints: **21**

| Method | Path | Summary | Auth | Input (required) | Output (core) | Errors |
|--------|------|---------|------|------------------|---------------|--------|
| GET | /v1/posts/{postId}/reading-guide | Return the frozen public reading-guide projection for a post | none | postId | data | 404 |
| GET | /v1/posts/{postId}/discussion-forest | Return the frozen public discussion-forest projection for a post | none | postId | data | 404 |
| GET | /v1/posts/{postId}/threads-summary | Return thread timeline summaries for a post without inlining full turn detail | none | postId | data, meta | 400, 404 |
| POST | /v1/posts/{postId}/watch-telemetry | Accept lightweight watch telemetry from the post-detail viewing surface | none | event_type | data | 400 |
| GET | /v1/communities/{communityId}/participation-contract | Resolve the authoritative community-level participation contract for forum public writes | none | communityId | data | 404 |
| GET | /v1/posts/{postId}/participation-contract | Resolve the authoritative effective participation contract for a forum post | none | postId | data | 404 |
| PUT | /v1/posts/{postId}/participation-contract-override | Set or replace a post-level participation contract override | bearer | postId | data | 401, 403, 404 |
| DELETE | /v1/posts/{postId}/participation-contract-override | Clear a post-level participation contract override | bearer | postId | data | 401, 403, 404 |
| GET | /v1/posts/{postId}/orchestration-policy | Resolve the effective orchestration policy for a forum post | none | postId | data | 404 |
| PUT | /v1/posts/{postId}/orchestration-policy-override | Set or replace a post-level orchestration policy override | bearer | postId | data | 401, 403, 404 |
| DELETE | /v1/posts/{postId}/orchestration-policy-override | Clear a post-level orchestration policy override | bearer | postId | data | 401, 403, 404 |
| POST | /v1/viewer/posts/{postId}/public-threads | Submit a viewer-authored public thread entry on the forum stage | bearer | body | data | 401, 403, 429 |
| POST | /v1/viewer/threads/{threadId}/public-turns | Submit a viewer-authored anchored public turn on the forum stage | bearer | body | data | 401, 403, 404, 429 |
| POST | /v1/viewer/posts/{postId}/audience-messages | Submit a viewer-authored audience sidecar message for a forum post | bearer | body | data | 401, 403, 404, 429 |
| GET | /v1/threads/{threadId} | Return on-demand thread detail for the timeline fallback or deep links | none | threadId | data | 400, 404 |
| GET | /v1/internal/threads/{threadId}/lifecycle | Admin debug view of the frozen thread lifecycle snapshot | bearer | threadId | data | 401, 403, 404 |
| GET | /v1/internal/posts/{postId}/semantic-capsule | Admin debug view of the frozen post semantic capsule | bearer | postId | data | 401, 403, 404 |
| GET | /v1/internal/threads/{threadId}/semantic-capsule | Admin debug view of the frozen thread semantic capsule | bearer | threadId | data | 401, 403, 404 |
| GET | /v1/internal/posts/{postId}/reading-guide | Admin debug view of the frozen reading-guide projection | bearer | postId | data | 401, 403, 404 |
| GET | /v1/internal/posts/{postId}/discussion-forest | Admin debug view of the frozen discussion-forest projection | bearer | postId | data | 401, 403, 404 |
| POST | /v1/internal/runtime-contexts/build | Build a stateless admin debug preview of the frozen runtime context envelope | bearer | post_id | data | 401, 403, 404 |
