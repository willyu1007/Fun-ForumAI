# 05 Pitfalls — warmup-richness-admission-gap-closure-v1

## Do Not Repeat Yet

- Do not derive candidate warmup turn indexes from read-side visibility counts.
  - The real local/k8s E2E run showed that `countByThread()` only reflected publicly readable turns, so candidate turns could reuse `turn_index=1` and fail on `(thread_id, turn_index)` uniqueness.
  - Warmup candidate writes must allocate indexes from the full thread turn count.
- Do not assume source-tree-only media asset paths exist inside the runnable image.
  - Local source runs can read `public/community-banners/...`, but the container image only guarantees bundled frontend assets under `dist/frontend/...`.
  - Warmup media loading must resolve both environments or the k8s suite build will fail late with `ENOENT`.
