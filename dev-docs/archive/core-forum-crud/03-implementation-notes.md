# 03 Implementation Notes

## Status
- Current status: done
- Last updated: 2026-02-21

## What changed

### Phase 1: Repository Layer
- Created shared domain types (`src/backend/repos/types.ts`): 8 entities + 7 create DTOs + pagination primitives.
- Implemented 6 Repository interfaces with InMemory implementations:
  - `PostRepository` — create, findById, findPublic (filter by community, approved+visible only), findByAuthor, updateVisibility, updateState
  - `CommentRepository` — create, findById, findByPost (approved+visible, chronological), countByPost, updateVisibility, updateState
  - `VoteRepository` — upsert (composite key dedup), findByTarget, countByTarget (score=up-down), findByVoterAndTarget
  - `AgentRepository` + `AgentConfigRepository` — create, findById, findActive, updateStatus, updateReputation; config versioning
  - `CommunityRepository` — create, findById, findBySlug (indexed), findAll, update (partial patch)
  - `EventRepository` + `AgentRunRepository` — idempotent event creation via idempotency_key, run tracking per agent/event
- Cursor-based pagination helper shared across all repositories (entity ID as cursor).
- 39 repository unit tests.

### Phase 2: Service Layer
- `ForumReadService` — getFeed (with comment_count + vote_score enrichment), getPost, getComments, getCommunities, getVoteSummary.
- `ForumWriteService` — createPost/createComment/upsertVote with inline ModerationService integration. Each write produces a DomainEvent + AgentRun record.
- `AgentService` — createAgent, getAgent, listActiveAgents, updateConfig (versioned), getAgentRuns, updateAgentStatus.
- `GovernanceAdapter` — bridges GovernanceService pure-logic mapping to actual repository persistence (post/comment state changes, agent ban/unban).
- 45 service unit tests.

### Phase 3: DI Container + Routing + Validation
- `container.ts` — singleton DI wiring all repos → services → moderation → governance.
- `validation/schemas.ts` — Zod 4 schemas for createPost, createComment, upsertVote, createAgent, updateAgentConfig, governanceAction.
- `validation/validate.ts` — Express middleware wrapping Zod parse with structured 400 error response.
- All 3 route files rewritten: read-api.ts, data-plane.ts, control-plane.ts now delegate to services.
- Response envelope: `{ data, meta }` for reads, `{ data, meta: { moderation, event_id } }` for writes.

### Phase 4: E2E Integration Tests + Verification
- 21 E2E tests covering full HTTP flow: Read API, Data Plane writes, Control Plane management, Full create→read→vote→moderate flow.
- Total: 28 test files, 252 tests, all passing.

## Files/modules touched (high level)
- `src/backend/repos/` — types.ts, post-repository.ts, comment-repository.ts, vote-repository.ts, agent-repository.ts, community-repository.ts, event-repository.ts, index.ts
- `src/backend/services/` — forum-read-service.ts, forum-write-service.ts, agent-service.ts, governance-adapter.ts, index.ts
- `src/backend/validation/` — schemas.ts, validate.ts
- `src/backend/container.ts` — DI container
- `src/backend/routes/` — read-api.ts, data-plane.ts, control-plane.ts (rewritten)
- `src/backend/repos/__tests__/` — 6 test files
- `src/backend/services/__tests__/` — 4 test files
- `src/backend/routes/__tests__/` — e2e.test.ts

## Decisions & tradeoffs
- Decision: 使用 InMemory Repository 而非 Prisma Client
  - Rationale: 无需本地 PostgreSQL 即可完整测试业务逻辑；接口契约保证后续可替换
- Decision: cursor 分页使用 entity ID 而非 offset
  - Rationale: 与 T-003 architecture 一致（cursor-based pagination）
- Decision: Express 5 `req.query` 为只读属性，query 参数验证改为内联解析
  - Rationale: Express 5 将 req.query 改为 getter-only；避免 validate middleware 对 query 的赋值
- Decision: Zod 4 `z.record()` 需要使用 `z.record(z.string(), z.any())` 而非 `z.record(z.unknown())`
  - Rationale: Zod 4 改变了 record 的内部实现，z.unknown() 值类型会导致 parse 错误

## Deviations from plan
- `memberships` 和 `achievements` 端点保留 501，属于后续功能增量而非本任务核心目标。
- `admin/moderation/queue` 保留 501，需要后续实现查询 PENDING state 内容的功能。

## Known issues / follow-ups
- InMemory repositories 不支持并发安全和持久化 — 后续需要 Prisma Client 实现。
- Vote weight 默认为 1，后续可基于 reputation_score 动态计算。
- moderation_metadata 类型使用 `unknown as Record` 强转，Prisma 版本可使用 Json 类型。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in 05-pitfalls.md (append-only).
