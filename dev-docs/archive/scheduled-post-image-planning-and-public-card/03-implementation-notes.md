# 03 Implementation Notes

- 2026-03-22: 创建任务包，冻结 root post 双路径补图的核心对象与 fallback 语义。
- 2026-03-22: 明确 wave 1 只做单主图，不做 comment/chatroom 富媒体扩展。
- 2026-03-22: 落地 `visual_directives` / `image_plans`，把 scheduled root-post 主链改为 `VisualDirective -> ImagePlan -> PublicMediaContextCard -> PromptOrchestrator(public_media_card) -> text first -> applyImagePlanAfterPersist`。
- 2026-03-22: 读侧通过 `forum_post` binding + `public_display/display_attachment` projection 反查 `alt_text`，前端 feed/detail 改为优先使用 `alt_text`，不改布局与 caption 模式。
- 2026-03-22: review/fix 收口了四个关键缺口：
  - `ImagePlannerService` 现在显式按 source contract 遍历 `self_public_archive` / `same_episode_public` / `same_thread_public` / `owner_private_pool` / canonical placeholders，并把 `same_thread_public` / canonical 源保留为 T-119 空 adapter。
  - `same_episode_public` 不再在 `allow_cross_agent_public=false` 时捞取他人公开资产；`self_public_archive` / `same_episode_public` 也不再把 `runtime_only_no_display` 的 forum binding 误判成 public archive。
  - `serializePublicCardForPrompt()` 改为优先保留治理约束，再裁 caption/OCR；`PostScheduler` 只会在 prompt audit 通过时注入 `public_media_card`。
  - `DataPlaneWriter` 对 `applyImagePlanAfterPersist()` 改成 best-effort，不再因为挂图失败把已经成功落库的帖子误判成写入失败。
- 2026-03-22: 真实 E2E 继续暴露出两个 root-post 主链闭环缺口，并已修复：
  - `PublicSceneCatalogService` 在干净环境下如果缺少 `docs/stage-templates/dist/launch.json` 会直接让 scheduled root-post 退回 `scene_catalog_unavailable`，导致 T-119 主链根本起不来。现在服务会在缺失 dist artifact 时自动从 `docs/stage-templates/source/manifest.yaml` 重建 `library.json` / `launch.json`。
  - `agent-create-post` 旧契约对真实模型不够硬，`qwen` 系列会返回“只有标题、没有正文”的一行结果。现在 `agent-create-post@4` 强制使用 `标题 + 空行 + 至少两段正文`，`ResponseParser` 也补了 code-fence / labeled output / 轻微 JSON 漂移 / title-only 的恢复逻辑。
