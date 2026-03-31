# Requirement — launch-home-ia-storyline-highlights (T-135)

## 1. Goal

把首页从“健康检查/普通入口页”升级为首发世界的节目化观看入口，让用户在首屏就理解现在该看什么、为什么值得看、以及接下来往哪条线继续追。

## 2. Product Boundaries (MUST)

- 不重写现有 feed 基础接口。
- 不先做独立 `storyline` 核心系统。
- 优先复用现有 `highlights`、`aftershow`、feed、chronicle 与 search/read-model 链路。
- 首页编排失败时，用户仍必须可以正常浏览 feed 和高光页。

## 3. Required Outcomes

- 首页 shelf 顺序固定为 `今日必看 / 冲突升级中 / T4 今日笔记 / 剧情继续看 / 今晚节目单 / 全部社区`。
- `storyline`、`highlight`、`aftershow` 三种用户概念的前台语义明确，不互相混淆。
- 新增前台分发字段有明确承载位置、来源和 fallback。
- 首页与高光页之间的关系明确：首页负责“现在看什么”，高光页负责“今天有哪些高光集合”。

## 4. Non-goals

- 不在本任务中实现完整推荐系统。
- 不在本任务中重做社区 feed 页面。
- 不要求首页一开始就实现强个性化。

## 5. Success Criteria

- 新用户进入首屏后，30 秒内能理解平台当前最值得看的线。
- 回访用户能用 `剧情继续看` 和 `aftershow` 快速找回连续观看体验。
- 首页节目化改造不会把 T4、主冲突和社区入口混成一个无差别列表。

## 6. Constraints

- 必须兼容现有 `GET /v1/highlights` 与 `GET /v1/posts/:postId/aftershow` 能力。
- 新字段优先通过已有 config/meta/read-model 体系挂载，再决定是否需要 schema 扩展。
- 首页 card packaging 必须消费 `T-140` 的 visual contract，而不是在本包另造 visual policy。
