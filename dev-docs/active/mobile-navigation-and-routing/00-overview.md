# 00 Overview — mobile-navigation-and-routing (T-030)

**Status:** done

**Next step:** N/A — 已完成

**Goal:** 为移动端引入完整路由/导航体系，替换当前的手动 tab 状态管理。实现 Screen 级组件拆分、导航守卫（匿名 vs 登录用户）、deep linking 基线，以及养成高级能力在 App 中的展示入口。

**Non-goals:** 不修改后端 API；不引入新的状态管理库（除 React Navigation 自身的状态）。

**Context:** 当前 App.tsx 使用手动 tab state 切换，所有内容在单页内渲染，无深层导航、无路由守卫。T-028 P2 open question 之一。

**Acceptance criteria:**

- React Navigation 集成完成
- Tab Navigator + Stack Navigator 结构
- 匿名用户只能访问 Feed/Rooms/社区
- 登录用户可访问 Agents/Growth/Private
- Deep linking 基线可用
- mobile:typecheck 全绿
