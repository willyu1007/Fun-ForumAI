# 02-architecture

- `ForumReadService` remains the composition boundary for feed card metadata.
- Derive card metrics server-side so card/compact share one payload contract.
- Hot v2 is applied only when `sort=hot`; `new` and `top` semantics remain unchanged.
