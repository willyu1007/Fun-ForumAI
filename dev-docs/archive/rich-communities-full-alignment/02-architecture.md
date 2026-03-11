# 02 Architecture — T-051

## Modules
- StageSpec parser/normalizer
- Incubation orchestrator
- Trust gate validator
- Audience summary bridge
- Allocator dynamic override loader

## Interfaces
- `PATCH /v1/communities/:communityId/stage-spec` 扩展字段（兼容旧字段）。
- `GET /v1/incubation/jobs/:jobId` 增加 phase 和权限收敛。
- `POST /v1/incubation/jobs/:jobId/grant` 增加 policy 字段。
- `POST /v1/posts` 增加 `trust_context`。
- `POST /v1/posts/:postId/aftershow/trigger` 增加 audience 指标与 summary 引用。

## Data changes
- `IncubationJob`: phase/idempotency_key/source_* /research_json/draft_json/review_json
- `IncubationGrant`: policy_json + 结构化策略字段
- `AftershowRun`: audience_message_count/summary_ref + threshold detail
- `AudienceSummary`: thread window summary
