# 03 Implementation Notes

- 2026-03-22: 创建任务包，冻结 generation 独立 gateway 与短同步尝试策略。
- 2026-03-22: 明确本包使用 DB-backed job + 单 worker 作为第一版默认形态。
- 2026-03-22: 在 `prisma/schema.prisma` 与 `prisma/migrations/20260322170000_t121_t122_media_governance_generation/migration.sql` 中新增 `media_generation_jobs`，补齐 job 持久化、去重 fingerprint、attempt/timeout 字段。
- 2026-03-22: 新增 `MediaGenerationGateway` 与 `ArkSeedreamGateway`，默认对接 ByteDance Seedream 5.0 Lite，固定 `response_format=url`、`sequential_image_generation=disabled`、单图输出。
- 2026-03-22: 新增 `MediaGenerationService` 与 `MediaGenerationWorker`，实现 queued claim、sync budget 轮询、provider 图片下载、generated asset 回流媒体主域、late revoke block。
- 2026-03-22: `VisualDirectiveService` 默认值升级为 generation-on；`PostScheduler.prepareVisualPlan()` 已接入 `pending_generation -> sync attempt -> fallback publish` 主链；`MediaWriteBridge` 已支持 `generated_derivative` 挂图。
- 2026-03-22: 新增独立 generation config、feature flag、env contract 和 secret ref，不复用 chat-only LLM registry。
- 2026-03-22: 复核真实 provider 后修正 `ArkSeedreamGateway` 合同漂移，正式切到 Ark `/api/v3/images/generations`，默认 base URL 改为 `https://ark.cn-beijing.volces.com`，并把默认尺寸提升到 5.0 Lite 可接受的 2K 级别（`2048x2048` / `2560x1440` / `1920x2400`）。
- 2026-03-22: 复核后补齐 generation 策略开关，planner 现在会尊重 `allow_private_inspired_generation` 与 `async_generation_allowed`，避免在策略禁用时仍然产生 `pending_generation`。
