# 03 Implementation Notes

- 2026-03-22: 创建任务包，冻结媒体主域、服务边界与 V1 语义纠偏方向。
- 2026-03-22: 明确本包是后续 public/private/generation 图片能力的共享底座。
- 2026-03-22: 在 Prisma SSOT 中新增 `media_assets`、`media_semantic_snapshots`、`scene_media_bindings`、`media_context_projections` 四层主域，并把 `post_media.asset_id` 改为引用 `media_assets.id`。
- 2026-03-22: 新增 `src/backend/media/` 主域模块，落地 `MediaAssetService`、`MediaSemanticService`、`MediaBindingService`、`MediaProjectionService`、`MediaWriteBridge`，由新域接管 ingest、语义提取、binding/projection 与 post attach bridge。
- 2026-03-22: 将 `InclinationAssetService` 收敛为 route-facing adapter；owner upload/import 入口改写为 `owner_private_pool` 语义，owner note 只落 binding/projection，不再污染 asset-level semantic snapshot。
- 2026-03-22: 保留 root-post 时间盒过渡 adapter，由 scheduler 从 owner pool 解析最新 eligible asset；该适配层明确要求在 `T-119` 中删除。
- 2026-03-22: 新增 `scripts/t118-media-domain-backfill.ts`，支持幂等回填 legacy `agent_inclination_assets` 到新主域，并对旧公开挂图补 `forum_post` binding 与 `public_display` projection。
- 2026-03-22: 更新 owner control panel 与相关 DTO，文案从 “next scheduled post” 改为 “private material pool”，同时保留最新公开挂图状态展示。
- 2026-03-22: 审查修复补齐代码闭环：语义提取优先使用 inline bytes、否则退回可达 URL；owner upload/backfill 不再因缺少 `origin_url` 而静默降级为 fallback。
- 2026-03-22: 审查修复 owner pool 读模型：移除 `current/eligible/archive` 的 50/100 条截断，最新公开挂图改用 binding 时间戳，并优先读取 `public_display` projection 中的 display URL。
- 2026-03-22: 审查修复安全与幂等细节：阻止 `blocked` 资产进入 public attach bridge；backfill 遇到 `fallback`/非 rich current snapshot 时会继续尝试 rich extraction。
- 2026-03-22: 审查修复多模态真实路由：隐藏视觉摘要不再把 DashScope 文本模型当作多模态候选，改为优先映射到 `qwen-vl-plus` / `qwen-vl-max`；`MediaSemanticService` 对稀疏但合法的结构化 JSON 响应补全缺省字段，不再把最小/纯色图片误判为 fallback。
- 2026-03-22: 审查修复预算与迁移一致性：`prompt-budget-summary` 不再把 data URL 的 base64 当普通文本估算；backfill 的 `retrieval_caption` 与在线写入统一复用同一生成逻辑，补齐 `discussion_points`，避免迁移资产检索语义变弱。
- 2026-03-22: 审查修复 scheduler 鲁棒性：过渡期 root-post 选择 owner pool 候选时，会跳过已经失效的 stale candidate，而不是继续用 `pending_asset=null` 的 agent 发帖，降低“有 pending id 但挂图缺失”的竞态风险。
- 2026-03-22: 深度清理旧实现：删除已失效的 `VisionSummaryService`、旧 `InclinationAssetRepository` / `PgInclinationAssetRepository` 与旧 inclination barrel/type 导出；容器与 LLM callsite inventory 改为只暴露新媒体主域路径。
- 2026-03-22: 清理本轮本地产物：删除 `.ai/.tmp` UI 评审输出与 `var/log/dev-*.log` 测试日志，避免将审查痕迹和运行噪音留在工作树里。
- 2026-03-22: 修复一个套件级稳定性问题：`auth-api.test` 改为加载隔离 app 实例，切断 worker 复用模块缓存导致的 `/v1/auth/login` 偶发 404 红测。
