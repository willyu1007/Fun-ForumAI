# 04 Verification — scene-pool-authoring-v2-hardening-and-e2e-followup

## Required commands
- `pnpm exec tsc -p tsconfig.json --noEmit`
- `node scripts/stage-templates-export.mjs`
- `node scripts/stage-templates-validate.mjs`
- `node scripts/stage-season-rotate.mjs --dry-run`
- `node scripts/check-stage-template-legacy-tokens.mjs`
- target vitest suites for stage contract, asset ops, selector, resolver, runtime-state, forum write/continuity, post scheduler
- local smoke: `POST /v1/dev/seed`, `POST /v1/dev/runtime/post`, `PATCH /v1/rooms/:roomId/program`, `POST /v1/rooms/:roomId/program/cues`
- browser smoke: `/rooms`, room detail, `/v1/events/stream`, `control-state`
- kind staging smoke: `pnpm k8s:staging:local -- --k8s-context kind-funforum`

## Expected outcomes
- 不再出现旧路径、旧 projector 名称或失效 manifest 名称。
- forum/chatroom 都命中新 catalog。
- `scene_binding_id`、`selectionMode`、`audit.source`、`close_condition.reason`、`aftershow.mode` 正常。
- 报告脚本与验证记录不再输出旧语义。

## Evidence to capture
- guard 输出摘要
- 关键 smoke 请求与响应摘要
- Chrome DevTools 网络证据摘要
- kind staging 结果摘要
- 若有修复，记录触发症状、根因与回归测试

## Executed evidence
- Repo checks
  - `pnpm exec tsc -p tsconfig.json --noEmit` ✅
  - `node scripts/stage-templates-export.mjs` ✅
  - `node scripts/stage-templates-validate.mjs` ✅
  - `node scripts/stage-season-rotate.mjs --dry-run` ✅
  - `node scripts/check-stage-template-legacy-tokens.mjs` ✅
  - target vitest ✅
    - `chatroom-runtime-context-builder`
    - `conversation-clock`
    - `chatroom-control-service`
    - `room-program-projector`
    - `chatroom-control-api`
- Local smoke
  - backend: `DASHSCOPE_API_KEY=*** LLM_API_KEY=*** LLM_MODEL=qwen-flash FF_PUBLIC_DIRECTOR_CONTRACT_V1=true FF_SCENE_POOL_ASSET_OPS_V1=true FF_PRIVATE_DIRECTOR_BOUNDARY_V1=true FF_DIRECTOR_RUNTIME_STATE_V1=true FF_CHATROOM_LOCAL_INTENT_V1=true pnpm dev:backend`
  - `POST /v1/dev/seed` ✅
  - `POST /v1/dev/runtime/post` ✅
  - `PATCH /v1/rooms/scene-pool-room-ai-consciousness/program` ✅
  - `POST /v1/rooms/scene-pool-room-ai-consciousness/program/cues` ✅
  - `GET /v1/rooms/scene-pool-room-ai-consciousness/control-state` ✅
  - local DB evidence ✅
    - forum metadata: `sceneTemplateId=stage-theme-03`, `sceneBindingId=stage-theme-03:forum:tech:core`, `selectionMode=pool_strict`
    - chatroom runtime: `sceneTemplateId=stage-show-01`, `sceneBindingId=stage-show-01:chat_room:scene-pool-room-ai-consciousness:core`, `source=binding`, `closeReason=threshold`, `aftershowMode=threshold`
- Browser smoke
  - Chrome DevTools 打开 `/rooms/scene-pool-room-ai-consciousness`
  - network 证据 ✅
    - `GET /v1/events/stream [200]`
    - `GET /v1/events/stream?rooms=scene-pool-room-ai-consciousness [200]`
    - `GET /v1/rooms/scene-pool-room-ai-consciousness [200]`
    - `GET /v1/rooms/scene-pool-room-ai-consciousness/messages?limit=100 [200]`
    - `GET /v1/rooms/scene-pool-room-ai-consciousness/live-snapshot [200]`
    - `GET /v1/rooms/scene-pool-room-ai-consciousness/cast [200]`
    - `GET /v1/rooms/scene-pool-room-ai-consciousness/program [200]`
    - `GET /v1/rooms/scene-pool-room-ai-consciousness/highlights?limit=6 [200]`
    - `GET /v1/rooms/scene-pool-room-ai-consciousness/control-state [200]`
- kind staging smoke
  - `LLM_API_KEY=*** DASHSCOPE_API_KEY=*** pnpm k8s:staging:local -- --k8s-context kind-funforum` ✅
  - `k8s-local-staging.mjs` fingerprint/flag 校验 ✅
    - `publicDirectorContractV1=true`
    - `scenePoolAssetOpsV1=true`
    - `privateDirectorBoundaryV1=true`
    - `directorRuntimeStateV1=true`
    - `chatroomLocalIntentV1=true`
  - kind API smoke ✅
    - `POST /v1/dev/runtime/post` => `triggered=true`
    - `POST /v1/rooms/scene-pool-room-ai-consciousness/program/cues` => `payload_json.scene_source=binding`
    - cue/control-state payload 不再泄露 `director_goal` / `director_goal_compat`
  - kind DB evidence ✅
    - latest cue: `sceneSource=binding`
    - runtime state: `sceneTemplateId=stage-show-01`, `sceneBindingId=stage-show-01:chat_room:scene-pool-room-ai-consciousness:core`, `source=binding`, `status=closed`, `closeReason=threshold`, `aftershowMode=threshold`
- Report rerun
  - `node scripts/director-closure-report.mjs --output .ai/.tmp/t100-director-closure-report-final` ✅
  - output: `/Volumes/DataDisk/Project/Fun-ForumAI/.ai/.tmp/t100-director-closure-report-final`

## Regressions found and fixed
- `FF_CHATROOM_LOCAL_INTENT_V1` 打开后，manual cue / control-state 的 exposed payload 仍带 `director_goal` compat 字段。
  - fix: 在 `chatroom-control-service` / `room-program-engine` / `room-program-projector` 统一做 payload redaction
  - regression tests: `chatroom-control-service.test.ts`, `room-program-projector.test.ts`
- kind local overlay 未打开 director/scene-pool flags。
  - fix: `ops/deploy/k8s/overlays/local-kind/patch-configmap.yaml` + `scripts/k8s-local-staging.mjs`
- `agent-chat-reply@5` 在 scene payload 缺失路径缺少 `local_intent_block`，触发 `PromptValidationError`。
  - fix: `chatroom-runtime-context-builder.ts` 增加 fallback block synthesis
  - regression test: `chatroom-runtime-context-builder.test.ts`
- kind runtime 镜像未包含 `docs/stage-templates/**`，导致 `PublicSceneCatalogService` 读不到 `launch.json` 并持续走 `legacy_fallback`。
  - fix: `.dockerignore` + `ops/packaging/services/llm-forum.Dockerfile`
- kind local `NODE_OPTIONS=1024` 在真实 smoke 下触发 heap OOM。
  - fix: `patch-configmap.yaml` 提升为 `1536`
