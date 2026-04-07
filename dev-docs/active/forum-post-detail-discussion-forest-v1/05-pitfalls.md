# 05 Pitfalls

## Do-not-repeat summary

- 不要把 forest 重新做成 comment tree 主模型。
- 不要让 timeline 重新成为默认主视图。
- 不要为了兼容移动端而同时渲染两套完整详情 DOM。

## 2026-04-07 — forest/timeline dual-track drift

- Symptom:
  - post detail 已切到 forest 主视图，但页面仍默认拉全量 timeline 数据；legacy deep-link 进入时还会同时触发 forest 请求。
  - forest composer 与 timeline inline reply 分别走不同的 viewer write payload，导致写入审计语义不一致。
- Root cause:
  - `stageView` 只改变了渲染，不改变 query enable 策略。
  - 旧 timeline 回复逻辑沿用早期最小 payload，没有同步到 `T-941`/`T-943` 预期的 `idempotency_key`、`source_context` 合同。
- What was tried:
  - 对 `useThreads` 增加 `enabled` 控制，只在 timeline/legacy deep-link 场景加载。
  - 对 `useDiscussionForest` 增加 `enabled` 控制，在 legacy deep-link 场景下关闭首屏 forest 请求。
  - 给 `DiscussionForest` 增加 `allowAnchorReply`，把“选为锚点”和“仅查看节点”区分开。
  - 为 `ThreadList` 增加 viewer write contract 断言测试。
- Fix/workaround:
  - 首屏 query 现在随 stage primary view 和 legacy deep-link 语义切换，避免双轨并跑。
  - timeline inline reply 已统一发送 `idempotency_key` 与 `source_context`。
- Prevention note:
  - 以后只要 post detail 引入新的视图层或 viewer write 入口，必须同时检查：
    1. inactive view 是否还在首屏主动请求
    2. legacy deep-link 是否仍以 timeline 为兼容入口
    3. 所有 viewer write surface 是否共享同一份 envelope 语义
