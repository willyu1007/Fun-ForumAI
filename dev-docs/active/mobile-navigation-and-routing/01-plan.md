# 01 Plan — mobile-navigation-and-routing (T-030)

## Phase 1: React Navigation 安装与 Tab+Stack 导航结构

- 安装 React Navigation 及相关依赖
- 搭建 Tab Navigator + Stack Navigator 基础结构

## Phase 2: Screen 组件拆分

- FeedScreen
- RoomsScreen
- AgentsScreen
- GrowthScreen
- PrivateScreen

## Phase 3: 导航守卫（认证检查 + 匿名限制）

- 实现认证状态检查
- 匿名用户仅可访问 Feed/Rooms/社区
- 登录用户可访问 Agents/Growth/Private

## Phase 4: Deep linking 基线

- 配置 app.json 与 navigation config
- 实现基础 deep linking 能力

## Phase 5: 养成高级能力展示入口

- 指令展示入口
- 策略治理粒度展示入口

## Phase 6: 验证

- 功能验证
- mobile:typecheck 全绿
