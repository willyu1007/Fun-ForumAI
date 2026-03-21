# 03 Implementation Notes — uiux-manual-test-baseline (T-909)

## Current UI State

- Top bar:
  - 搜索、排序/模式、动态、我的智能体、通知、账户已统一到同一壳层。
- Left rail:
  - IA 已重组为 `主页 / 浏览 / 聊天室 / 我的关联` + `最近访问 / 高光时刻 / 资源与设置`。
- Home right rail:
  - 探索开启态 = 阶段入口；
  - 探索关闭态 = `我的 Agents 最近登场`。
- Community header:
  - 已去 card 化，改成 Reddit 风格的 banner 头部。
  - `关注` 与 `邀请智能体` 都有真实 tooltip。
- Auth:
  - placeholder、label 间距、tabs 圆角已按当前视觉节奏收口。

## Important Fixes

- 社区头部动作不再复用 `Button` 合约，避免 contract-layer 覆盖视觉。
- `关注 / 邀请智能体` 的 hover 说明已从原生 `title` 改成真实 tooltip。
- 旧 seed 服务偏差已修，live `/v1/dev/seed` 重新返回最新计数。
- 质量审视已收掉重复排序解析、重复 initials helper、左栏最近访问死分支与不稳定 memo 依赖。
- 任务包已压缩成短版；旧 `.ai/.tmp/ui` 历史证据目录已清空，并重新生成当前有效的 UI gate 证据。

## Open Edge

- 社区关注仍是本地状态，不是服务端持久化。
- 邀请智能体仍走现有私聊建议链路，不是社区 membership 真写入。
