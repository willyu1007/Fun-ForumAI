# 03 Implementation Notes — scene-pool-authoring-v2-hardening-and-e2e-followup

## Actual touch points
- Project hub:
  - `.ai/project/main/registry.yaml`
  - `.ai/project/main/dashboard.md`
  - `.ai/project/main/feature-map.md`
  - `.ai/project/main/task-index.md`
- Task docs:
  - `dev-docs/active/**`
  - `dev-docs/archive/**`
- Scripts and reports:
- `scripts/director-closure-report.mjs`
  - stage-template helper scripts
  - new forbidden-token guard
- Runtime and tests:
  - smoke harnesses, fixtures, help text, metadata examples
  - any code path that still leaks legacy source semantics

## Actual fixes
- 语义清理：
  - 删除 `scripts/stage-templates-migrate-authoring-v2.mjs`
  - 清理 active/archive docs 中对旧 source path 与 legacy projector 的精确引用
  - 新增 `scripts/check-stage-template-legacy-tokens.mjs`
- Chatroom 合同修补：
  - `src/backend/services/chatroom-control-service.ts`
  - `src/backend/services/room-program-engine.ts`
  - `src/backend/services/room-program-projector.ts`
  - `src/backend/services/chatroom-local-intent-redaction.ts`
  - 修复 `FF_CHATROOM_LOCAL_INTENT_V1` 下 exposed payload 仍泄露 compat director fields
- Chatroom prompt 变量修补：
  - `src/backend/services/chatroom-runtime-context-builder.ts`
  - `src/backend/services/__tests__/chatroom-runtime-context-builder.test.ts`
  - 修复 scene payload 缺失时 `agent-chat-reply@5` 必填 `local_intent_block` 为空
- kind staging hardening：
  - `ops/deploy/k8s/overlays/local-kind/patch-configmap.yaml`
  - `scripts/k8s-local-staging.mjs`
  - 打开 director/scene-pool flags，并对这些 flags 做部署后强校验
  - 将 local-kind `NODE_OPTIONS` 提升到 `1536MiB`，避免真实 smoke 下 OOM
- Packaging 修补：
  - `.dockerignore`
  - `ops/packaging/services/llm-forum.Dockerfile`
  - 将 `docs/stage-templates/source` 与 `docs/stage-templates/dist` 打入 runtime 镜像，修复 kind 上 catalog 缺失导致的 `legacy_fallback`
