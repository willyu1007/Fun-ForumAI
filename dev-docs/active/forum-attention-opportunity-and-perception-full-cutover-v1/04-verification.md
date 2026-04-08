# 04 Verification

## 2026-04-08 Package Exit Evidence

- Static verification
  - `pnpm exec tsc --noEmit`
- Targeted automated verification
  - `pnpm vitest run src/backend/services/__tests__/participation-contract-service.test.ts src/backend/services/__tests__/public-write-governance-service.test.ts src/backend/services/__tests__/semantic-projection-service.test.ts src/backend/services/__tests__/attention-opportunity-broker.test.ts src/backend/services/__tests__/forum-read-service.test.ts`
  - `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts --testNamePattern="aftershow|viewer/posts/:postId/public-threads|viewer/posts/:postId/audience-messages|internal/runtime-contexts/build|orchestration policy"`
  - `pnpm vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx --testNamePattern="relation teasers out of the stage header flow|aftershow"`
- Project-level E2E closeout
  - `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
    - result: `59` tests passed
  - `pnpm exec playwright test --config=playwright.config.mjs tests/web/playwright/forum-orchestration.e2e.spec.ts`
    - result: `12` tests passed across `desktop/tablet/mobile` x `light/dark`

## Real Runtime Rehearsal

- Local kind rollout
  - `pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-db-migrate --skip-seed --frontend-build-profile none`
  - Result:
    - backend rollout succeeded
    - runtime fingerprint verified as `code_fingerprint=sha256:ed5a6ceb92180346b626773e40f98ddc441ec2671d81934407b8c4d749201ecd`
    - health checks on the live backend returned `app/db/redis = ok`
- Live viewer-read path on `kind-funforum`
  - `GET /v1/posts/<feed-post>/participation-contract`
    - returned `audience_sidecar + summary_only + aftershow_only`
    - `audience_lane.posting_enabled=true`
    - `stage_open_reply.new_thread_enabled=false`
    - `stage_open_reply.turn_reply_enabled=false`
  - `GET /v1/posts/<feed-post>/reading-guide`
    - returned a non-empty reading guide (`entries=3`)
  - `GET /v1/posts/<feed-post>/discussion-forest`
    - returned a populated forest (`nodes=10`)
- Live viewer-write governance proof on `kind-funforum`
  - `POST /v1/viewer/posts/<feed-post>/audience-messages`
    - returned `201`
    - returned a stable `audit_id`
  - Direct DB verification:
    - `risk_event_logs.payload_json.audit_record.schema_version = forum-public-write-audit.v2`
    - `resource_ref = { kind: "AUDIENCE_MESSAGE", id: ... }`
    - `auth_context.community_role = VIEWER`
    - `auth_context.session_id` and `auth_context.user_agent_hash` are populated
- Live rollback / cutover proof on `kind-funforum`
  - `PUT /v1/posts/<feed-post>/orchestration-policy-override` with `{ cutover: { envelope_enabled: false } }`
    - returned `200`
    - effective policy reflected `envelope_enabled=false`
  - `POST /v1/internal/runtime-contexts/build`
    - returned `runtime_context = null`
    - returned `perceived_slice = null`
    - policy payload still preserved `cutover.envelope_enabled=false`
  - `DELETE /v1/posts/<feed-post>/orchestration-policy-override`
    - returned `200`
    - effective policy reset to `post_override=null`
- Live aftershow probe on `kind-funforum`
  - Initial repro on `post_id=cmnpjvv44005x0mmvbx8vqnfe`
    - prior manual trigger created `aftershow_runs.status=SKIPPED`
    - DB evidence showed `meta.reason = threshold_not_met`
    - corresponding artifact row existed with `status = ABORTED`
  - Forced manual publish
    - `POST /v1/posts/cmnpjvv44005x0mmvbx8vqnfe/aftershow/trigger` with `{ "mode": "MANUAL", "force": true }`
    - returned `201`
    - response contained:
      - `run_id = 93908adb-68ed-4083-a224-eed73fc6a6e5`
      - `artifact_id = 45599671-bc2f-4edc-a9e1-8c9c5a976fd0`
      - `artifact_status = PUBLISHED`
      - `callouts = 1`
  - Stable read verification
    - `GET /v1/posts/cmnpjvv44005x0mmvbx8vqnfe/aftershow`
    - returned `artifact_id = 45599671-bc2f-4edc-a9e1-8c9c5a976fd0`, `status = PUBLISHED`, `callouts = 1`
    - repeated 3 consecutive reads returned the same published artifact id and timestamp
  - DB cross-check
    - `aftershow_artifacts.id = 45599671-bc2f-4edc-a9e1-8c9c5a976fd0`
    - `status = PUBLISHED`
    - `published_at = 2026-04-08 07:02:45.76`
    - one `aftershow_callouts` row and one `notification_id` persisted

## Residual Notes

- `compare_debug.include_viewer_telemetry=false` 已完成实现，并已有 code-path + unit/e2e coverage；当前保留这一条 residual note，是因为 live kind 环境没有稳定 public artifact 可直接证明 allocator 内部 `watch_telemetry_snapshot=null`，若强行补证据需要新增 debug-only introspection surface。
