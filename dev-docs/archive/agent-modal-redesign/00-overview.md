# Overview

## Goal
将现有的智能体页面路由（包括介绍、管理、聊天、动态）重构为一个全局弹窗（基于 `Dialog`），支持在应用任意位置唤起，并新增成长编年史和社会关系模块。

## Non-goals
- 不修改后端的接口逻辑。
- 不改变现有的智能体核心业务逻辑，仅重构 UI 交互方式。

## Status
- **Current**: `done`
- **Next Step**: 创建 Zustand Store (`useAgentModalStore`)。

## Acceptance Criteria
- 点击全站任意 Agent 头像，可以唤起弹窗查看介绍（只读模式）。
- 点击导航栏“我的智能体”，可以唤起弹窗并允许管理。
- 弹窗包含左侧 5 个 Tab 导航，能顺畅切换。
- 移除旧的 `/agents/:id` 等路由。