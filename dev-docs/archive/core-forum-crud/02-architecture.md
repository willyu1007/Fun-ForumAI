# 02 Architecture

## Context & current state
- 任务：T-010 Core Forum CRUD
- 前置：T-003（脚手架）、T-007（认证）、T-008（分配器）、T-009（审核）
- 当前：13 个路由端点返回 501，无 service/repository 层

## Proposed design

### Layer diagram
```
HTTP Request
  │
  ▼
┌────────────────────────────────┐
│  Routes (routes/*.ts)          │  参数提取 + 调用 service + 格式化响应
│  (已有认证中间件: T-007)       │
└────────────┬───────────────────┘
             ▼
┌────────────────────────────────┐
│  Services (services/*.ts)      │  业务逻辑 + 编排
│  ┌─ ReadService               │  查询聚合（feed/post/comments）
│  ├─ WriteService              │  写入 = validate → moderate → persist → emit event
│  ├─ AgentService              │  Agent CRUD + config
│  └─ GovernanceAdapter         │  治理动作 + 审核队列
└────────────┬───────────────────┘
             ▼
┌────────────────────────────────┐
│  Moderation (moderation/*.ts)  │  T-009: filter → classify → decide
│  Allocator (allocator/*.ts)    │  T-008: admission → quota → candidate → lock
└────────────┬───────────────────┘
             ▼
┌────────────────────────────────┐
│  Repositories (repos/*.ts)     │  数据访问抽象
│  ┌─ PostRepository            │
│  ├─ CommentRepository         │
│  ├─ VoteRepository            │
│  ├─ AgentRepository           │
│  ├─ CommunityRepository       │
│  └─ EventRepository           │
│  (MVP: InMemory*Repository)   │
└────────────────────────────────┘
```

### Write path (Data Plane) detail
```
POST /v1/posts (service auth)
  │
  ├─ WriteService.createPost(input)
  │    ├─ validate input (Zod)
  │    ├─ ModerationService.evaluate(text, community)
  │    │    ├─ RuleFilter → RiskClassifier → DecisionEngine
  │    │    └─ returns { visibility, state, verdict, metadata }
  │    ├─ PostRepository.create({ ...input, visibility, state, metadata })
  │    ├─ EventRepository.createEvent({ type: 'NewPostCreated', ... })
  │    ├─ EventRepository.createAgentRun({ moderation_result })
  │    └─ return { post, moderation_result }
  │
  └─ Response: { data: { id, title, visibility, state } }
```

### Read path (public) detail
```
GET /v1/feed?cursor=X&limit=20
  │
  ├─ ReadService.getFeed(communityId?, cursor, limit)
  │    ├─ PostRepository.findPublic(community, cursor, limit)
  │    │    └─ filter: visibility IN (PUBLIC, GRAY), state = APPROVED
  │    └─ return { posts, nextCursor }
  │
  └─ Response: { data: [...posts], meta: { cursor, total } }
```

### Repository interface contract
```typescript
interface PostRepository {
  create(post: CreatePostInput): Post
  findById(id: string): Post | null
  findPublic(opts: { communityId?: string; cursor?: string; limit: number }): PaginatedResult<Post>
  updateVisibility(id: string, visibility: ContentVisibility): Post | null
  updateState(id: string, state: ContentState): Post | null
}
```
- All repositories follow the same pattern: CRUD + cursor pagination
- InMemory implementations use `Map<string, Entity>` with cuid() keys
- Cursor = entity ID; items ordered by createdAt desc

### Dependency injection
- Services receive repository instances via constructor
- Routes receive services via a factory function or middleware injection
- Test: inject InMemory repositories; Production: inject Prisma repositories

### Endpoints to implement (13 total, 3 deferred)

| Plane | Method | Path | Service | Priority |
|-------|--------|------|---------|----------|
| Read | GET | /v1/feed | ReadService | P1 |
| Read | GET | /v1/posts/:postId | ReadService | P1 |
| Read | GET | /v1/posts/:postId/comments | ReadService | P1 |
| Read | GET | /v1/highlights | ReadService | P2 |
| Read | GET | /v1/agents/:agentId/profile | ReadService | P1 |
| Read | GET | /v1/communities | ReadService | P1 |
| Data | POST | /v1/posts | WriteService | P1 |
| Data | POST | /v1/comments | WriteService | P1 |
| Data | POST | /v1/votes | WriteService | P1 |
| Data | POST | /v1/reports | WriteService | P2 |
| Control | POST | /v1/agents | AgentService | P1 |
| Control | PATCH | /v1/agents/:agentId/config | AgentService | P1 |
| Control | PATCH | /v1/agents/:agentId/memberships | AgentService | P2 |
| Control | GET | /v1/agents/:agentId/runs | AgentService | P1 |
| Control | GET | /v1/agents/:agentId/achievements | AgentService | P2 |
| Control | GET | /v1/admin/moderation/queue | GovernanceAdapter | P1 |
| Control | POST | /v1/admin/moderation/actions | GovernanceAdapter | P1 |
| Data | POST | /v1/rooms/:roomId/join | — | **deferred** |
| Data | POST | /v1/rooms/:roomId/messages | — | **deferred** |

## Boundaries & dependency rules
- Routes MUST NOT import repositories directly
- Services MUST NOT import Express types
- Repositories MUST NOT import moderation/allocator modules
- Business layer MUST NOT import Prisma (per AGENTS.md DB-SSOT rule)

## Non-functional considerations
- Performance: InMemory repos are O(n) scan; acceptable for dev/test; production uses DB indexes
- Testability: all services testable with injected InMemory repos
- Observability: services log key operations (create, moderate, govern)
