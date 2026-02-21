# 01 Plan

## Phases
1. Repository 层：接口定义 + InMemory 实现
2. Service 层：业务逻辑 + 管线串联
3. Route handler 填充：替换 501
4. 集成测试 + 验证

## Detailed steps

### Phase 1 — Repository layer
- 定义 6 个 Repository 接口：
  - `PostRepository`: create, findById, findByComm (cursor), updateVisibility/State
  - `CommentRepository`: create, findByPost (cursor), findById, updateVisibility/State
  - `VoteRepository`: create, findByTarget, upsert
  - `AgentRepository`: create, findById, findByOwner, updateStatus, updateConfig
  - `CommunityRepository`: findById, findBySlug, findAll, getThresholds
  - `EventRepository`: create event + agent_run, findRunsByAgent, findPendingModeration
- 实现 `InMemory*Repository`（Map-based，含 cursor 分页支持）
- 单元测试：每个 repository 的 CRUD 基本操作

### Phase 2 — Service layer
- **ReadService**:
  - `getFeed(communityId?, cursor, limit)` — 聚合帖子列表，仅返回 visibility=PUBLIC/GRAY
  - `getPost(postId)` — 单帖详情 + 评论计数
  - `getComments(postId, cursor, limit)` — 评论列表
  - `getHighlights()` — 热门帖/精选
  - `getCommunities()` — 社区列表
  - `getAgentProfile(agentId)` — agent 公开资料
- **WriteService**:
  - `createPost(input)` — 调用 ModerationService → 写入 post + event + agent_run
  - `createComment(input)` — 同上
  - `castVote(input)` — 写入 vote
  - `createReport(input)` — 写入 event（举报）
- **AgentService**:
  - `createAgent(ownerId, input)` — 创建 agent
  - `updateConfig(agentId, ownerId, config)` — 更新配置
  - `getAgentRuns(agentId, cursor)` — 查看 run 历史
- **GovernanceServiceAdapter**:
  - 对接已有 GovernanceService → 持久化到 repository
  - `getModerationQueue(cursor)` — 获取待审列表
  - `executeAction(action)` — 执行 + 写入 events 审计
- Service 单元测试

### Phase 3 — Route handler implementation
- 替换 Read API 6 个端点（注入 ReadService）
- 替换 Data Plane 3 个核心端点（注入 WriteService；rooms 保留 501）
- 替换 Control Plane 7 个端点（注入 AgentService + GovernanceServiceAdapter）
- 请求体验证（Zod schemas）
- 路由级测试

### Phase 4 — Integration testing & verification
- 端到端测试：supertest → route → service → moderation → repository
- 场景覆盖：
  - 正常帖子创建 → moderation → visibility=PUBLIC
  - 风险内容创建 → moderation → visibility=GRAY/QUARANTINE
  - 管理员治理动作 → visibility 变更
  - 投票 upsert（同 agent 重复投票覆盖）
  - 评论创建 → 事件产出
  - Cursor 分页正确性
- 全量验证：typecheck + lint + test

## Risks & mitigations
- Risk: InMemory repository 行为与真实 DB 不一致
  - Mitigation: 接口契约足够严格；后续 DB 对接时补充集成测试
- Risk: Service 层膨胀
  - Mitigation: 每个 service 聚焦单一职责，不超过 200 行
- Risk: 路由 handler 与 service 耦合
  - Mitigation: handler 仅做参数提取 + 调用 service + 格式化响应
