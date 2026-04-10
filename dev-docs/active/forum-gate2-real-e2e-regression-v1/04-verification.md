# 04 Verification

## Planned evidence

- local-kind rollout command and rollout status
- seeded-data confirmation
- browser/API walkthrough evidence for Gate 2 paths
- targeted test reruns for each fix

## 2026-04-10

### Local-kind rollout

- Ran:
  - `pnpm k8s:staging:local -- --k8s-context kind-funforum --run-smoke`
- Result:
  - rollout completed on `kind-funforum`
  - runtime fingerprint matched workspace code fingerprint
  - canonical seed profile loaded
  - generic runtime smoke skipped because the local overlay exposes a single ready backend pod, while that smoke requires at least two

### Live API inspection

- Verified feed/post/forest/participation contract surfaces from the local-kind backend.
- Sampled `audience_sidecar` post:
  - `post_id=0550c340-afc2-42c5-98c7-e311b1599b28`
  - participation contract showed `stage_open_reply.enabled=false`, `audience_lane.enabled=true`
  - discussion forest included late-entry nodes with `is_late_entry=true` and `placement_reason=LATE_ENTRY_REATTACH`
- Sampled `open_reply` post:
  - `post_id=6b5e92a0-1f7c-4ae3-8ebb-9469d1ccc789`
  - participation contract showed `stage_open_reply.enabled=true`, `new_thread_enabled=true`, `turn_reply_enabled=true`

### Live browser walkthrough

- Verified with live browser automation:
  - `audience_sidecar` page rendered `clusterCount=5`, `replyButtons=0`, audience-lane compose copy present
  - `open_reply` page rendered `clusterCount=4`, `replyButtons=4`
  - clicking `回应这里` produced visible anchor preview, ready badge, and anchor capsule
- Screenshots were captured locally during investigation and removed before commit as non-SSOT test artifacts. The retained evidence is the command/result summary in this packet.
- Live browser stage write:
  - clicked `回应这里`
  - submitted a real public turn
  - response status `201`
  - success notice rendered
  - submitted body became visible after refetch
- Live browser audience-lane write:
  - submitted a real audience message on the `audience_sidecar` post
  - response status `201`
  - success notice rendered
  - submitted body became visible

### Canonical viewer write API

- Direct canonical write verification:
  - `POST /v1/viewer/threads/:threadId/public-turns` returned `201`
  - forest node count increased from `4` to `5`
  - inserted node stayed in the target thread and rendered as `placement_reason=ROOT_APPEND`
- Validation guard check:
  - canonical viewer write rejects malformed `source_context`
  - missing/invalid `source_context.discovered_via` returned a `400 VALIDATION_ERROR` as expected

### Tooling bug regression and fix verification

- Added regression test:
  - `pnpm exec vitest run scripts/lib/__tests__/k8s-secret-resolution.test.ts`
  - result: `3/3` passing
- Re-ran focused Gate 2 frontend tests:
  - `pnpm exec vitest run src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - result: `25/25` passing
- Re-ran static typecheck:
  - `pnpm exec tsc --noEmit`
  - result: pass
- Re-ran local-kind staging with a non-default primary key env name:
  - `ALT_QWEN_KEY=*** node scripts/k8s-local-staging.mjs --k8s-context kind-funforum --dashscope-api-key-env ALT_QWEN_KEY --skip-image-refresh --skip-db-migrate --skip-seed`
  - result: pass
- Confirmed merged secret state after fix:
  - `primary_matches_expected=true`
  - `secondary_matches_expected=true`
  - `primary_is_stale_bad_key=false`
