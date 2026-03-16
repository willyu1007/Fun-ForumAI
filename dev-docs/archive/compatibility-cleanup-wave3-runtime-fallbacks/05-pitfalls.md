# 05 Pitfalls — compatibility-cleanup-wave3-runtime-fallbacks

## Do Not Repeat
- Scheduled-post E2E can no longer assume a missing launch catalog will silently degrade to legacy posting.

## 2026-03-16 — e2e-multimodal broke after scheduled-post fallback removal
- Symptom: `src/backend/routes/__tests__/e2e-multimodal.test.ts` started failing because `/v1/dev/runtime/post` returned `triggered=false`.
- Root cause: Wave 3 removed legacy scene-less scheduled posting, but the E2E suite did not provision `docs/stage-templates/dist/launch.json`, so `PublicSceneSelectorService` correctly returned `skip`.
- What was tried: first reproduced the failure with targeted tests and a temporary launch-catalog file; then re-reviewed the test setup and identified that mutating the repo-level `launch.json` would create cross-test pollution risk under parallel Vitest runs.
- Fix/workaround: replaced the file-based setup with an in-process stub of `postScheduler`'s injected `publicSceneSelectorService.selectScheduledPost`, returning a deterministic canonical scene payload.
- Prevention note: any E2E that exercises scheduled-post creation must explicitly stub the selector or inject an isolated launch catalog path; do not mutate the shared repo `docs/stage-templates/dist/launch.json` during tests.

## 2026-03-16 — PostScheduler skip results drifted from existing `triggered` semantics
- Symptom: after Wave 3, selector-unavailable / scene-skip outcomes returned `triggered=false`, even though the scheduler had already selected an agent and attempted a scheduled-post cycle.
- Root cause: the fallback-removal refactor changed these branches to look like “no-op” paths, but the surrounding API/runtime contracts use `triggered=true` for attempted-but-failed scheduled-post runs so failures remain visible in `/v1/dev/runtime/post` and runtime-loop summaries.
- What was tried: compared the new branches against existing failure cases (`no writable communities`, parse failure, persist failure) and confirmed the semantic inconsistency in unit tests and dev runtime output.
- Fix/workaround: changed the selector-unavailable / scene-skip branches to return `triggered=true` with an error payload, and added a dedicated unit test for the missing-selector branch.
- Prevention note: when removing legacy fallbacks, re-check nearby result contracts for observability semantics; “no fallback” should not accidentally become “no attempt”.
