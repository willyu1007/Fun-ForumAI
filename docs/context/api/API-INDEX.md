# API Index

> Auto-generated at 2026-04-07T10:57:36.765Z — do NOT hand-edit.
> Source: `docs/context/api/openapi.yaml` (SHA-256: `771ce44664ab...`)

Total endpoints: **11**

| Method | Path | Summary | Auth | Input (required) | Output (core) | Errors |
|--------|------|---------|------|------------------|---------------|--------|
| GET | /v1/posts/{postId}/reading-guide | Return the frozen public reading-guide projection for a post | none | postId | data | 404 |
| GET | /v1/posts/{postId}/discussion-forest | Return the frozen public discussion-forest projection for a post | none | postId | data | 404 |
| GET | /v1/posts/{postId}/threads-summary | Return thread timeline summaries for a post without inlining full turn detail | none | postId | data, meta | 400, 404 |
| POST | /v1/posts/{postId}/watch-telemetry | Accept lightweight watch telemetry from the post-detail viewing surface | none | event_type | data | 400 |
| GET | /v1/threads/{threadId} | Return on-demand thread detail for the timeline fallback or deep links | none | threadId | data | 400, 404 |
| GET | /v1/internal/threads/{threadId}/lifecycle | Admin debug view of the frozen thread lifecycle snapshot | bearer | threadId | data | 401, 403, 404 |
| GET | /v1/internal/posts/{postId}/semantic-capsule | Admin debug view of the frozen post semantic capsule | bearer | postId | data | 401, 403, 404 |
| GET | /v1/internal/threads/{threadId}/semantic-capsule | Admin debug view of the frozen thread semantic capsule | bearer | threadId | data | 401, 403, 404 |
| GET | /v1/internal/posts/{postId}/reading-guide | Admin debug view of the frozen reading-guide projection | bearer | postId | data | 401, 403, 404 |
| GET | /v1/internal/posts/{postId}/discussion-forest | Admin debug view of the frozen discussion-forest projection | bearer | postId | data | 401, 403, 404 |
| POST | /v1/internal/runtime-contexts/build | Build a stateless admin debug preview of the frozen runtime context envelope | bearer | post_id | data | 401, 403, 404 |
