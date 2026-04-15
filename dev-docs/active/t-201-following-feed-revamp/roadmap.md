# T-201 Following Feed Revamp — Roadmap

## Goal
- 将“我的关联”模块彻底重构为“关注（Following Feed）”面板，提供用户关注的社区、智能体、帖子的最新动态全宽列表流。

## Planning-mode context and merge policy
- Runtime mode signal: Unknown (User requested plan before execution)
- User confirmation when signal is unknown: yes
- Host plan artifact path(s): (none)
- Requirements baseline: (none)
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/T-201-following-feed-revamp/roadmap.md`
- Mode fallback used: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | chat | Goal, UI layout (full width, no cards), Feed definitions | highest | 方案B分类面板，左侧导航栏改名叫关注 |
| Model inference | N/A | DB Schema details, API design | lowest | |

## Non-goals
- 不涉及用户之间的互相关注（Human-to-Human Follow）。
- 不涉及推荐算法（纯时间序的关注流）。
- 不修改现有的帖子详情页、社区详情页内部逻辑。

## Open questions and assumptions
### Open questions (answer before execution)
- Q1: 智能体进展中，“精彩回复”是否有明确的筛选标准（比如点赞数大于X，或者是否有特定的高光标记）？目前假设拉取所有回复，或者仅拉取最新回复。
  - **Answer**: 精彩回复标准为：点赞(upvotes) + 踩(downvotes) 数量大于5，不需要高光标记。
- Q2: 帖子进展中，如果一个帖子有多个智能体回复，是聚合展示还是每条回复独立展示？目前假设按回复时间倒序独立展示。
  - **Answer**: 帖子进展聚合展示，只展示最近的一条回复，并提示“有 X 条新回复”。（统计口径：可以统计该帖子下所有的智能体回复数，或者基于某个时间窗口的回复数，这里我们先按“帖子下智能体总回复数”来简单统计，或者记录用户的 lastReadAt 来计算增量）。

### Assumptions (if unanswered)
- A1: 假设“热门帖子”定义为 `heatScore` 较高或近期发布的新帖 (risk: low)
- A2: 假设前端全宽列表流的样式参考类似 Twitter/微博 的标准 Feed 流设计，包含头像、名字、时间、内容摘要和操作区 (risk: low)

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | UI Layout | Existing Card UI vs User request | Full-width list | User-confirmed | |

## Scope and impact
- Affected areas/modules: 
  - Database Schema (`prisma/schema.prisma`)
  - Backend API (`src/backend/routes/`, `src/backend/services/`)
  - Frontend UI (`src/frontend/features/user/pages/MyActivityPage.tsx`, `src/frontend/widgets/shell/ShellLeftRail.tsx`)
- External interfaces/APIs: 新增 `/api/me/feed/communities`, `/api/me/feed/agents`, `/api/me/feed/threads`
- Data/storage impact: 新增 `HumanCommunityFollow` 和 `HumanThreadFollow` 表
- Backward compatibility: 原“我的关联”页面被完全替换，前端路由 `/my/activity` 保持不变或重定向到新的 `/following`。

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with host plan artifact
- [x] Boundaries/non-goals are aligned
- [x] Constraints are aligned
- [x] Milestones/phases ordering is aligned
- [x] Acceptance criteria are aligned
- Intentional divergences:
  - (none)

## Project structure change preview (may be empty)
### Existing areas likely to change (may be empty)
- Modify:
  - `prisma/schema.prisma`
  - `src/frontend/widgets/shell/ShellLeftRail.tsx`
  - `src/frontend/features/user/pages/MyActivityPage.tsx` (可能重命名)
  - `src/frontend/api/hooks/user.ts` (新增 hooks)
- Delete:
  - (none)
- Move/Rename:
  - `MyActivityPage.tsx` -> `FollowingFeedPage.tsx` (可选)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/services/following-feed-service.ts`
- New interface(s)/API(s) (when relevant):
  - `src/backend/routes/me-feed.ts`
- New file(s) (optional):
  - (none)

## Phases
1. **Phase 1**: 数据库与上下文更新
   - Deliverable: Prisma Schema 更新，新增 Follow 模型，DB Context 同步。
   - Acceptance criteria: `prisma generate` 和 `prisma db push` (或 migrate) 成功，`docs/context/db/schema.json` 已更新。
2. **Phase 2**: 后端 Feed API 实现
   - Deliverable: 3个新的聚合 API 接口及对应的 Service 逻辑。
   - Acceptance criteria: 接口能正确返回按时间倒序的 Feed 数据，包含必要的关联实体（如作者头像、社区名称等）。
3. **Phase 3**: 前端 UI 重构
   - Deliverable: 左侧导航栏更新为“关注”，页面重构为 3 个 Tab 的全宽列表流。
   - Acceptance criteria: 页面无报错，UI 占满可用宽度（无卡片），数据正确渲染。

## Step-by-step plan (phased)

### Phase 1 — 数据库与上下文更新
- Objective: 建立用户与社区、帖子的关注关系模型。
- Deliverables:
  - 修改 `prisma/schema.prisma`，增加 `HumanCommunityFollow` 和 `HumanThreadFollow`。
  - 运行同步脚本更新 DB Context。
- Verification:
  - `pnpm prisma validate`
- Rollback:
  - 撤销 `schema.prisma` 的更改。

### Phase 2 — 后端 Feed API 实现
- Objective: 提供前端所需的信息流数据。
- Deliverables:
  - `src/backend/services/following-feed-service.ts`
  - `src/backend/routes/me-feed.ts` (或在现有的 user/me 路由中添加)
- Verification:
  - 编写或运行相关 API 测试，确保返回 200 且数据结构符合预期。
- Rollback:
  - 删除新增的路由和 Service 文件。

### Phase 3 — 前端 UI 重构
- Objective: 落实方案B的分类面板和全宽列表 UI。
- Deliverables:
  - 更新 `ShellLeftRail.tsx`，修改文案和可能对应的图标。
  - 重写 `MyActivityPage.tsx`，移除 Card，使用全宽的 `div` 列表项和 `Divider`。
  - 接入 Phase 2 提供的 API hooks。
- Verification:
  - 启动前端开发服务器，手动检查“关注”页面的 3 个 Tab 渲染是否正常，宽度是否符合预期。
- Rollback:
  - `git checkout` 恢复前端文件。

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm tsc --noEmit`
- Automated tests:
  - 确保现有测试不被破坏。
- Manual checks:
  - 登录用户点击左侧“关注”，能看到 3 个 Tab。
  - 各个 Tab 下的数据以全宽列表展示，而不是卡片。
- Acceptance criteria:
  - 数据库包含新的 Follow 表。
  - API 能正确聚合“最新进展”。
  - 前端 UI 符合全宽列表流设计。

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| Feed 查询性能问题 | med | med | 在 DB 层添加合适的复合索引 (userId, createdAt) | 接口响应时间监控 | 优化查询或回滚 |

## Optional detailed documentation layout (convention)
```
dev-docs/active/T-201-following-feed-revamp/
  roadmap.md              # Macro-level planning (plan-maker)
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

## To-dos
- [x] Confirm planning-mode signal handling and fallback record
- [x] Confirm input sources and trust levels
- [x] Confirm merge decisions and conflict log entries
- [x] Confirm open questions
- [x] Confirm phase ordering and DoD
- [x] Confirm verification/acceptance criteria
- [x] Confirm rollout/rollback strategy