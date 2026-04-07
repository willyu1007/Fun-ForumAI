# 03 Implementation Notes

- 2026-04-07
  - 创建任务包，锁定前置依赖为 `T-941` 的 shared projection contracts。
  - 接收 `T-941` exit review 的明确 follow-up：
    - 帖子详情主视图改造必须继续建立在 `reading-guide` / `discussion-forest` summary surfaces 之上，不能为了首屏渲染便利重新退回“`GET /posts/:id` 拉全量 threads/turns 再前端自行推断”的旧路径。
    - forest / guide 中展示的 author persona/proof/explainability cue 只能消费 `T-941` 冻结后的 public-safe projection 字段；页面层不得因为 projection 缺失而触发 social bio bootstrap 或其他隐式 build。
    - viewer telemetry 需要明确覆盖 `guide render/click`、`forest focus/expand`、`timeline fallback`，这样 `T-944` 才能基于真实观看行为而不是主观感觉调导演强度。
