# 04 Verification

## Automated checks

- `pnpm exec prisma format`
- `pnpm exec prisma validate`
- `pnpm exec prisma generate`
- `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/media-v1-hardening-contract-lineage-cutover/artifacts/env/03-validation-log.md`
- `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/active/media-v1-hardening-contract-lineage-cutover/artifacts/env/04-context-refresh.md`
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- `pnpm exec tsc -b --pretty false 2>&1 | rg -n "(media|lineage|generation_spec|compiled_prompt|audit_decision|semantic_v3|rootPostAttachmentOnly|strictAuditEnforced|lineageRequired|promptBrief|RuntimeDashboard|admin-api.ts|backfill-media-lineage|mediaLineageEdgeRepo|pg-media-lineage-edge|pg-media-generation-job|pg-media-rollout-controller-override)"`
  - 结果：无 media 相关 TypeScript 诊断。
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-multimodal.test.ts src/backend/routes/__tests__/admin-media-api.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/frontend/features/admin/components/__tests__/RuntimeDashboard.test.tsx src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx src/backend/media/__tests__/media-projection-service.test.ts src/backend/media/__tests__/media-generation-service.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/media/__tests__/media-semantic-service.test.ts src/backend/media/__tests__/ark-seedream-gateway.test.ts`
  - 结果：`10` 个 test files、`61` 个 tests 全通过。
  - 覆盖点：
    - `semantic_v3_enforced` 在 public prompt serialization 上会阻断 legacy schema。
    - `strict_audit_enforced=false` 时 serializer 可放宽缺失 audit_context 的 block。
    - generation scheduling 在 rollout hardening 开启时，会因为缺失 `audit_context`、lineage 不完整、source snapshot 非 v3 而直接 `cancelled + audit_blocked`。
    - admin rollout / lifecycle API、planner 输出、tiny-image semantic fallback 与 provider adapter 编译结果没有被清理阶段改坏。
    - legacy `inclination-asset` 写路由已返回 `404`，新 `/media/*` 路由继续可写。

## Manual checks

- 确认新的 agent media API 写路径为 `/v1/agents/:agentId/media/*`，对应 route tests 已改到新路径并通过。
- 确认本地媒体读取只暴露 `/v1/media/local/*`；旧的 `/v1/inclination-assets/media/local/*` 已移除。
- 确认 admin media rollout controller 暴露的 hardening 开关为：`semantic_v3_enforced`、`strict_audit_enforced`、`lineage_required`、`root_post_attachment_only`。
- 使用本地 dev backend + 真实 DashScope/Qwen multimodal key 执行 authenticated HTTP 验收：
  - `POST /v1/agents/:agentId/inclination-asset/upload` 返回 `404`，确认 legacy 写路由已从注册表移除。
  - `POST /v1/agents/:agentId/media/url` 导入真实 HTTPS 图片后成功返回语义摘要，后端日志确认只对 URL import 触发了一次真实视觉模型调用。
  - `POST /v1/agents/:agentId/media/upload` 上传 1x1 PNG 后返回 fallback summary，后端 session log 中没有出现额外 `LlmClient` / vision provider 调用，证明 tiny-image 短路生效。
- `export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/llm_forum'; pnpm prisma migrate status`
  - 结果：通过连通性检查；确认 kind-staging 在 apply 前只剩后续非 T-918 migration 未落库。
- `export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/llm_forum'; pnpm prisma migrate deploy`
  - 结果：通过；kind-staging 目标库已完成当前 repo migration apply。
- `export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/llm_forum'; pnpm media:backfill-lineage --dry-run --batch-size=200`
  - 结果：通过；`prepared_edges=37711`、`skipped_existing_edges=7974`、`orphaned_marks=35028`、`generation_jobs_updated=0`。
- `export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/llm_forum'; pnpm media:backfill-lineage --batch-size=200`
  - 结果：通过；`inserted_edges=37780`。
- `PGPASSWORD=postgres psql 'postgresql://postgres:postgres@127.0.0.1:55432/llm_forum' -Atc "select count(*) from media_lineage_edges; select count(*) from media_lineage_edges where edge_kind = 'orphaned_lineage'; select count(*) from _prisma_migrations where migration_name='20260324113000_t918_media_v1_hardening_contract_lineage_cutover';"`
  - 结果：通过；分别返回 `45551`、`35039`、`1`。
- `PGPASSWORD=postgres psql 'postgresql://postgres:postgres@127.0.0.1:55432/llm_forum' -Atc "select count(*) from image_plans ip left join visual_directives vd on vd.id = ip.directive_id where ip.directive_id is not null and vd.id is null;"`
  - 结果：通过；返回 `0`，kind-staging 上未发现 `image_plans_directive_id_fkey` orphan。
- `curl -sf -H 'Authorization: Bearer <redacted>' 'http://127.0.0.1:4200/v1/admin/media/lineage/image_plan/cmnf74ynl008o0mjvpmoqhtpk?depth=2' | jq '.data | {edge_count: (.edges|length), node_count: (.nodes|length)}'`
  - 结果：通过；返回 `edge_count=3`、`node_count=3`，证明 admin lineage trace 读面在当前 kind-staging 数据上可用。
