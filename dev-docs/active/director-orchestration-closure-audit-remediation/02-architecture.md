# 02 Architecture — T-098

## Repair Focus
- selector contract 不能继续只存在于 `scheduled_post` 的薄实现里；
- chatroom 不能继续依赖 `legacy_fallback` 作为常态；
- runtime authority 不能忽略 template closing / aftershow policy；
- actor prompt 不能继续消费 compatibility-only director carrier。

## Decisions
- remediation 通过新 task 承接，不 reopen `T-094 / T-095`；
- `F-060` 与 `R-060~R-062` 在修复完成前统一视为 `in-progress`；
- `chat_room` binding 走 scene pool 正式资产，而不是把 fallback 当作长期产品形态；
- `director_goal` compatibility 数据只允许存在于 hidden audit / event payload，不进入 actor prompt；
- close reason 统一向设计文档推荐口径靠拢，避免审计和指标使用双命名。

## Key Touchpoints
- selector / forum: `src/backend/services/public-scene-selector-service.ts`, `src/backend/services/forum-scene-continuity-service.ts`, `src/backend/runtime/post-scheduler.ts`, `src/backend/runtime/context-builder.ts`
- scene pool asset: `docs/stage-templates/source/**`, `docs/stage-templates/dist/**`, `scripts/stage-templates-export.mjs`, `scripts/stage-templates-validate.mjs`, `src/backend/stage/stage-template-ops.js`
- chatroom runtime: `src/backend/services/chatroom-scene-contract-resolver.ts`, `src/backend/services/runtime-scene-state-manager.ts`, `src/backend/services/chatroom-runtime-context-builder.ts`, `.ai/llm-config/registry/prompt_templates.yaml`
- telemetry / smoke: runtime event repo, local runtime endpoints, `scripts/k8s-local-staging.mjs`
