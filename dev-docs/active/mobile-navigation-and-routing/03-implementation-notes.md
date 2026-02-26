# 03 Implementation Notes — mobile-navigation-and-routing (T-030)

## Status

- Current status: done
- Last updated: 2026-02-26

## What changed

### Phase 1: React Navigation 安装

已安装依赖:
- `@react-navigation/native` 7.1.31
- `@react-navigation/bottom-tabs` 7.15.2
- `@react-navigation/native-stack` 7.14.2
- `react-native-screens` 4.24.0
- `react-native-safe-area-context` 5.7.0

### Phase 2: AuthContext + Navigation Stacks

**AuthContext** (`src/auth/auth-context.tsx`):
- 从 App.tsx 中抽出认证状态（token/login/logout/error）为独立 Context
- 自动从 SecureStore 恢复 token
- login 时持久化 token，logout 时清除
- 使用 useMemo 防止不必要的 re-render

**导航类型** (`src/navigation/types.ts`):
- FeedStackParams: FeedList / PostDetail
- RoomsStackParams: RoomsList / RoomDetail
- AgentsStackParams: AgentsList
- GrowthStackParams: GrowthView
- PrivateStackParams: SessionsList / Chat
- ProfileStackParams: Profile
- TabParams: 6 个 tab（包含 NavigatorScreenParams）

**五个 Stack Navigator**:
- `feed-stack.tsx` — FeedList 列表 + PostDetail 详情页
- `rooms-stack.tsx` — RoomsList 列表 + RoomDetail 消息页（含 SSE 实时更新）
- `agents-stack.tsx` — AgentsList（创建/查看 Agent）
- `growth-stack.tsx` — GrowthView（Agent 成长数据）
- `private-stack.tsx` — SessionsList + Chat（含 SSE 实时更新、发送消息、结束会话）

每个 Stack 内的 Screen 独立管理自己的数据获取和状态，通过 `useAuth()` 获取 token。

### Phase 3: 导航守卫

- MainTabs 中条件渲染：匿名用户只看到 Feed / Rooms / 我的 三个 tab
- 登录用户可看到全部 6 个 tab（Feed / Rooms / 养成 / 成长 / 私聊 / 我的）
- ProfileStack + AuthScreen：始终可见的"我的"tab，未登录时显示登录表单，登录后显示账户信息和退出按钮
- 无需路由拦截器：通过 tab 可见性 + Context 组合实现

### Phase 4: Deep linking

- `app.json` 添加 `scheme: funforum`
- iOS `associatedDomains` + Android `intentFilters` 配置完成
- App.tsx `linking` 对象映射所有路由到 URL pattern
- 支持 `funforum://` 和 `https://funforum.ai` 两种 scheme

### Phase 5: 清理

- 删除旧的 `src/screens/` 下 5 个 screen 组件
- 删除旧的 `src/components/` 下 TabBar / AppHeader / LoginCard
- App.tsx 从 362 行缩减到 ~40 行（纯导航容器）

## 架构变更

```
App.tsx (thin shell)
├── SafeAreaProvider
├── AuthProvider (token + login/logout)
└── NavigationContainer (linking config)
    └── MainTabs (Bottom Tab Navigator)
        ├── FeedTab → FeedStack (FeedList / PostDetail)
        ├── RoomsTab → RoomsStack (RoomsList / RoomDetail + SSE)
        ├── AgentsTab* → AgentsStack (AgentsList) [auth required]
        ├── GrowthTab* → GrowthStack (GrowthView) [auth required]
        ├── PrivateTab* → PrivateStack (SessionsList / Chat + SSE) [auth required]
        └── ProfileTab → ProfileStack (login/logout)
```

\* = 仅登录用户可见

## Verification

- `pnpm -s mobile:typecheck` — 通过 (0 errors)
- `pnpm -s typecheck` — 通过
- `pnpm -s test` — 31 files, 268 tests 全部通过
