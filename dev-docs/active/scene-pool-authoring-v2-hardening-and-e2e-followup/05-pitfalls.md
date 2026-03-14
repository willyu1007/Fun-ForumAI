# 05 Pitfalls — scene-pool-authoring-v2-hardening-and-e2e-followup

## Known risks
- 归档文档若继续保留失效精确路径，会误导后续 LLM 把历史路径当作现行 SoT。
- 删除迁移脚本后，仓库不再提供现成回放入口；若需要历史迁移，只能从 git history 恢复。
- smoke 依赖真实模型、feature flags 与本地数据库状态；环境缺项时容易把环境问题误判成回归。
- `scripts/director-closure-report.mjs` 会保留 historical 统计，因此 `chatroom.runtime_sources` 仍可能包含修复前留下的 `legacy_fallback` 记录；收口时应以“最新 smoke 证据 + 最新 runtime state”作为是否回归的判据，而不是把历史行数当成当前失败。

## Guardrails
- 先执行 guard 再做 smoke，避免在错误语义基线下继续验证。
- 任何新发现的 blocker 都必须补测试或文档证据，不能只在任务说明里口头记录。
- 本包不顺手扩 scope 到无关历史问题，避免 hardening 任务再次膨胀。

## Real pitfalls found in this run
- kind local overlay 最初没有打开 `FF_PUBLIC_DIRECTOR_CONTRACT_V1` / `FF_SCENE_POOL_ASSET_OPS_V1` / `FF_PRIVATE_DIRECTOR_BOUNDARY_V1` / `FF_DIRECTOR_RUNTIME_STATE_V1` / `FF_CHATROOM_LOCAL_INTENT_V1`，导致 smoke 在旧合同上“假通过”。
- kind runtime 镜像最初未包含 `docs/stage-templates/**`，使 `PublicSceneCatalogService` 返回 `null`，chatroom resolver 全量回退到 `legacy_fallback`。
- 新 flags 打开后，local-kind `NODE_OPTIONS=1024` 会在真实 tick + prompt 渲染下打到 heap ceiling。
- chatroom `agent-chat-reply@5` 对 `local_intent_block` 是 hard requirement；一旦最新节目事件缺少 scene payload，就会在 `ConversationClock` 首轮 tick 抛 `PromptValidationError`。
