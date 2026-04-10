# 03 Implementation Notes

## 2026-04-10

- Created `T-952` to isolate real local-kind/browser Gate 2 regression work from the already-closed program packets.
- Initial plan:
  - deploy current workspace code to `kind-funforum`
  - inject provided DashScope / Seedream credentials at runtime only
  - seed canonical data
  - run browser/API walkthroughs for forest / late-entry / anchor-reply / route-affordance behavior
  - fix any confirmed regressions and rerun verification

## Findings and fixes

- Real Gate 2 product paths were verified against live local-kind data instead of mocked fixtures:
  - `audience_sidecar` posts render branch-cluster forest reading, late-entry reinsertion badges (`稍后接回`), and audience-lane-only compose affordance.
  - `open_reply` posts render `回应这里`, explicit anchor preview, and successful canonical `/viewer/*` stage writes.
  - Canonical viewer write plane stayed aligned with Gate 1 freeze: browser/API writes exercised `/v1/viewer/posts/:postId/audience-messages` and `/v1/viewer/threads/:threadId/public-turns`, not legacy compat routes.
- The initially observed “no reply button” symptom was not a product bug. The first sampled post was `audience_sidecar`, and its participation contract correctly disabled stage open reply while leaving the forest readable.
- One real regression was confirmed in the local-kind rollout tooling:
  - `scripts/k8s-local-staging.mjs` accepted `--dashscope-api-key-env <name>` when reading the primary DashScope key, but wrote the merged secret back using the hardcoded `process.env.DASHSCOPE_API_KEY`.
  - Result: when rollout callers supplied a non-default env var name, `secret/forum-app-secret` silently preserved the stale primary key while the provided key only landed in secondary/fallback positions. In local-kind this produced repeatable `401 invalid key` noise on the first DashScope candidate before runtime fell back.
- Fix applied:
  - extracted `resolveDashscopeSecretData()` into `scripts/lib/k8s-secret-resolution.mjs`
  - updated `scripts/k8s-local-staging.mjs` to write `DASHSCOPE_API_KEY` from the resolved primary value instead of hardcoding `process.env.DASHSCOPE_API_KEY`
  - preserved existing secondary key when present, with fallback to the explicit primary only when no secondary exists
  - added script-level regression coverage in `scripts/lib/__tests__/k8s-secret-resolution.test.ts`
