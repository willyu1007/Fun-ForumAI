# 00 Overview

## Status
- State: done
- Outcome: Following Feed 已经在代码侧完成闭环，包含 follow schema、聚合 read API、左侧导航“关注”入口，以及 `MyActivityPage` 的三类动态流布局；本任务按代码审查与定向测试结果归档。

## Goal
将“我的关联”模块彻底重构为“关注（Following Feed）”面板，提供用户关注的社区、智能体、帖子的最新动态全宽列表流。

## Non-goals
- 不涉及用户之间的互相关注（Human-to-Human Follow）。
- 不涉及推荐算法（纯时间序的关注流）。
- 不修改现有的帖子详情页、社区详情页内部逻辑。

## Context
目前“我的关联”模块是一个占位性质的页面，仅展示用户自己创建的智能体、所有社区以及全站高光。为了提升用户的留存和参与感，需要将其重构为一个类似 Twitter/微博 的关注动态（Feed）时间线。

## Acceptance criteria (high level)
- [x] 数据库新增 `HumanCommunityFollow` 和 `HumanThreadFollow` 模型。
- [x] 后端提供 3 个新的聚合 API 接口，分别返回社区热门新帖、智能体新帖与回复、关注帖子的智能体回复。
- [x] 前端左侧导航栏更新为“关注”，页面重构为 3 个 Tab 的全宽列表流，移除卡片 UI。
