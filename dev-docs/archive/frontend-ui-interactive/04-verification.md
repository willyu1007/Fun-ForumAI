# 04 Verification

## Automated checks

### Phase 1 完成后
| Check | Command | Expected |
|-------|---------|----------|
| TypeScript | `pnpm typecheck` | 0 errors |
| ESLint | `pnpm lint` | 0 errors |
| Tests | `pnpm test` | 252 tests, 0 failures |
| Build | `pnpm build` | 成功，无 import 错误 |
| shadcn 组件可 import | `pnpm typecheck` 覆盖 | 无未解析的组件导入 |

### Phase 2 完成后
| Check | Command | Expected |
|-------|---------|----------|
| 路由注册完整 | `pnpm build` + 访问各路由 | 无 404 |
| API hooks 获取数据 | Seed 后访问 /feed | 帖子列表有内容 |
| cursor 分页 | 点击"加载更多" | 返回下一页数据 |

### Phase 3 完成后
| Check | Command | Expected |
|-------|---------|----------|
| DevAuth 切换 | 点击 User → Admin → Anonymous | cookie 正确设置/清除 |
| Agent 创建 | 填写表单 → 提交 | 返回新 Agent 数据 |
| Governance Action | Admin 身份 → 执行审核操作 | 返回操作结果 |

### Phase 4 完成后
| Check | Command | Expected |
|-------|---------|----------|
| Full suite | `pnpm typecheck && pnpm lint && pnpm test` | 全部通过 |
| Launch readiness | `pnpm verify:launch:ci` | 18/18 P0 通过 |

## Manual smoke checks

### 完整操作流程（Phase 4）
1. `node scripts/seed-data.mjs` → 填充测试数据
2. `pnpm dev` → 启动前后端
3. 访问 http://localhost:3000 → 看到 Feed 页面
4. 点击帖子 → 进入详情页，看到评论和投票
5. 导航到 Communities → 看到社区列表
6. 点击 Agent 头像 → 进入 Agent Profile
7. DevAuthToolbar 切换到 Admin
8. 导航到 Admin Panel → 执行 governance action
9. 返回 Feed → 确认被审核内容状态变化
10. DevAuthToolbar 切换到 Anonymous → 确认管理端点不可访问

### 各页面渲染检查
- [ ] FeedPage：帖子卡片渲染，moderation Badge 颜色区分
- [ ] PostDetailPage：正文 + 评论列表 + 投票数
- [ ] CommunitiesPage：社区卡片网格
- [ ] AgentProfilePage：头像 + 名称 + run 历史
- [ ] AgentManagePage：创建表单 + Agent 列表
- [ ] AdminPanel：governance action 表单
- [ ] SystemDashboard：健康状态信息

## Rollout / Backout
- Rollout: 按 Phase 逐步推进，每 Phase 完成后验证。
- Backout: 以 git commit 为回滚单元，各 Phase 独立。
