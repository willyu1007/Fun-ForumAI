# T-010 — Core Forum CRUD Roadmap

## Goal
- 构建 Service + Repository 层，将后端从"501 脚手架"升级为"可工作的 Forum API"。
- 串联安全三件套（T-007 写入守卫 + T-008 事件分配器 + T-009 审核管线）进入真实写入路径。

## Scope
- 6 个 Repository 接口 + InMemory 实现
- 4 个 Service（ReadService, WriteService, AgentService, GovernanceAdapter）
- 13 个路由端点实现（3 个 rooms 端点 deferred）
- 请求体 Zod 验证
- 端到端集成测试

## Non-goals
- PostgreSQL / Prisma Client 对接
- Agent Runtime（LLM 调用）
- 前端页面
- 聊天室业务逻辑

## Phases
1. **Phase 1: Repository layer**
   - Deliverable: 6 个 repo 接口 + InMemory 实现 + 单元测试
   - Acceptance: CRUD + cursor 分页可工作
2. **Phase 2: Service layer**
   - Deliverable: 4 个 service + moderation 串联 + 事件产出
   - Acceptance: 写入经过审核并落库；读取正确过滤 visibility
3. **Phase 3: Route handlers**
   - Deliverable: 13 个端点替换 501（3 个 rooms deferred）
   - Acceptance: HTTP 端到端可工作
4. **Phase 4: Integration testing**
   - Deliverable: supertest 端到端测试 + 全量验证
   - Acceptance: typecheck + lint + test all green

## Step-by-step plan

### Phase 1 — Repository layer
- 定义共享类型（domain entities, CreateInput DTOs, PaginatedResult）
- 实现 PostRepository（create, findById, findPublic, updateVisibility/State）
- 实现 CommentRepository（create, findByPost, findById）
- 实现 VoteRepository（upsert, findByTarget）
- 实现 AgentRepository（create, findById, findByOwner, updateStatus）
- 实现 CommunityRepository（findById, findBySlug, findAll, getThresholds）
- 实现 EventRepository（createEvent, createAgentRun, findRunsByAgent, findPendingModeration）
- 单元测试覆盖各 repo
- Rollback: 仅添加新文件，不修改现有代码

### Phase 2 — Service layer
- ReadService: getFeed, getPost, getComments, getHighlights, getCommunities, getAgentProfile
- WriteService: createPost, createComment, castVote, createReport
  - 串联 ModerationService.evaluate()
  - 写入 event + agent_run
- AgentService: createAgent, updateConfig, getRuns, getAchievements
- GovernanceAdapter: getModerationQueue, executeAction (对接 GovernanceService + repos)
- Service 单元测试（mock repos）
- Rollback: 仅添加新文件

### Phase 3 — Route handlers
- 创建 DI 容器/工厂：构建 service + repo 实例
- Read API: 注入 ReadService，替换 6 个端点
- Data Plane: 注入 WriteService，替换 3 个端点（+ reports）
- Control Plane: 注入 AgentService + GovernanceAdapter，替换 7 个端点
- Zod schemas for request body validation
- Rollback: git revert route 文件

### Phase 4 — Integration testing
- supertest 端到端：创建帖子 → 读取 feed → 验证可见性
- 风险内容场景：创建 → moderation → QUARANTINE → admin approve → PUBLIC
- 投票 upsert 场景
- Cursor 分页场景
- 全量验证
- Rollback: 仅添加测试文件

## Verification and acceptance criteria
- 所有 P1 端点返回真实数据（非 501）
- 写入路径经过 moderation 审核
- 读取路径过滤 visibility/state
- 治理动作可工作
- 147+ 已有测试 + 新增测试全部通过

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| InMemory 与 DB 行为不一致 | medium | medium | 严格接口契约 + cursor 规范 | DB 对接时发现 | 补充 DB 集成测试 |
| Service 层膨胀 | medium | low | 单一职责 + 200 行上限 | Code review | 拆分 service |
| Route 与 service 耦合 | low | medium | DI 容器隔离 | 测试困难 | 重构注入 |
| 请求验证遗漏 | medium | high | Zod schema 全覆盖 | 非法请求通过 | 补充 schema |
