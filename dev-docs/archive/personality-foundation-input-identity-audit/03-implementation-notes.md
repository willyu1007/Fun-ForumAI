# 03 Implementation Notes

## Current status
- 状态：in progress（功能与验证主链已跑通）
- 说明：T-045 代码链路已完成 Phase 0~3，`typecheck + e2e + full test` 均已通过。

## Phase 0: Feature flag & config contract
- 新增 `FF_PROMPT_AUDIT_V1` 到 `env/contract.yaml`（默认 `false`）。
- `src/backend/lib/config.ts` 新增 `features.promptAuditV1`。

## Phase 1: EventPayload contract + EventBridge enrichment
- `src/backend/allocator/types.ts` 的 `EventPayload` 扩展为完整 V1 富化字段（全部 optional，保持 non-breaking）。
- 新增 `src/backend/runtime/controversy-score.ts`，沉淀 controversy 关键词启发式算法。
- `PromptLayerService` 改为复用公共 controversy helper，避免双实现漂移。
- `EventBridge` 改造为：
  - `bridge()` fire-and-forget；
  - 异步富化 `POST_CREATED/COMMENT_CREATED/VOTE_CAST`；
  - 查询失败时回退最小 payload 并 warning，不丢事件。
- `CommentRepository` 新增 `findByPostAll(postId)`（全评论口径），InMemory/Pg 均已实现。
- `EventBridge` 线程参与者按“评论作者首次出现顺序去重，最多 50”聚合。
- `CandidateSelector` 去除 `any-cast`，改为 typed 读取 `tags/controversy_score`。

## Phase 2: Profile patch + avatar HTTPS closure
- `createAgentSchema.avatar_url` 改为 HTTPS-only。
- 新增 `updateAgentProfileSchema`：
  - `display_name?`、`avatar_url?`（`https://...` 或 `null`）；
  - 至少一项必填。
- `AgentRepository`（InMemory/Pg）新增 `updateProfile()`。
- `AgentService` 新增 `updateProfile()` 业务入口。
- `control-plane` 新增 `PATCH /v1/agents/:agentId/profile`：
  - `admin` 可改任意 agent；
  - `user` 仅可改 owner 自己的 agent。
- 前端 `useCreateAgent` 去掉无效 `owner_id`，支持可选 `avatar_url`。
- `AgentCreateWizard` 创建请求补传 `avatar_url`。

## Phase 3: Prompt structured audit output
- `PromptLayerService` 新增 `composeLayersWithAudit()`，并保留 `composeLayers()` 兼容。
- Audit 固定结构：
  - `version/scene/includedLayerIds/tokenEstimates/lintWarnings/trimReasons`
- `FF_PROMPT_AUDIT_V1=true` 时输出 `PromptAudit` 结构化日志（不含 conversation/memory 明文）。
- `/v1/dev/prompts/render` 返回新增 `audit` 字段。

## Open follow-ups
- 评估 EventBridge enrichment 查询的缓存与批量化策略（当前版本先保证 correctness）。
- 仓库历史 lint 基线仍有 42 errors/21 warnings（非本任务文件），后续可单开治理任务。
