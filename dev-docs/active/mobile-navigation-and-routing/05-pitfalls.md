# 05 Pitfalls — mobile-navigation-and-routing (T-030)

## Do-not-repeat summary

- 新增导航依赖后必须先 pnpm install 再 typecheck。
- Deep linking 配置需同步 app.json 和 navigation config。
- React Navigation 条件渲染 Tab.Screen 需要注意：当 token 变化导致 tab 数量变化时，Navigator 会自动处理但需确保没有 stale state。

## Pitfall log

| # | Issue | Resolution |
|---|-------|------------|
| 1 | 旧 screen 组件和新 navigation stack 共存导致困惑 | 删除旧 `src/screens/` 和旧 `src/components/{TabBar,AppHeader,LoginCard}` |
| 2 | 匿名用户无法登录（移除旧 LoginCard 后） | 添加 ProfileTab（始终可见）包含 AuthScreen |
