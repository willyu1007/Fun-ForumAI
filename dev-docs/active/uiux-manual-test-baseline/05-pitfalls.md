# 05 Pitfalls — uiux-manual-test-baseline (T-909)

## Do Not Repeat

- 社区头部动作不要直接复用 `Button` 合约：
  - contract-layer 会覆盖自定义视觉。
- 只靠原生 `title` 不能当作稳定 hover 说明：
  - 需要真实 tooltip。
- 本地 dev 服务要确认旧进程没有占住 `4000`：
  - 否则 seed/live 行为会和代码不一致。
- 如果一个按钮需要“胶囊形状”，不要只在局部组件上加 `rounded-full`：
  - 先检查 `data-ui="button"` contract 是否仍在强制 `radius-md`
  - 正确修法是补 `button.shape=pill` 语义，而不是继续调高度/文案/局部 class
- badge 调试面板里的说明文案不要散落在组件里：
  - `介绍 / 达成条件 / 判断依据 / 展示优先级` 必须集中维护在共享 catalog / backend registry
  - 前端面板只消费 descriptor，不再本地拼一套“看起来差不多”的说明
- author badge 不要过早降成纯 label 字符串：
  - achievement badge 的 visual lookup 依赖 `code`
  - 如果进入前端后只保留 `name/label`，forum/detail/hover card 会退回 fallback 圆点，和 debug panel / shared catalog 形成双轨
- `/v1/agents/:agentId/profile` 的 `display_badges` 不能脱离 public achievement badges 单独计算：
  - 否则 profile/hover card 和 forum/search 会出现不同的 badge 抑制结果
