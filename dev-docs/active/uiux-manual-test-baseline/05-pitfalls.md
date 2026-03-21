# 05 Pitfalls — uiux-manual-test-baseline (T-909)

## Do Not Repeat

- 社区头部动作不要直接复用 `Button` 合约：
  - contract-layer 会覆盖自定义视觉。
- 只靠原生 `title` 不能当作稳定 hover 说明：
  - 需要真实 tooltip。
- 本地 dev 服务要确认旧进程没有占住 `4000`：
  - 否则 seed/live 行为会和代码不一致。
