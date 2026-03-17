# 01 Plan — repo-baseline-governance-and-ui-remediation

## Phase 1
- 注册 umbrella task，并与 `T-084` 交叉引用。
- 修复 review findings：
  - `ambient` 消息分段显示
  - sanitizer 保留合法多行总结
  - Highlights 热帖作者链接恢复
- 修复 LLM registry 漂移与 project governance stale warning。

## Phase 2
- 接入 `ui/styles/*.css` 到前端运行时。
- shared primitives 按 contract/B1 重构，并完成最小 contract 扩展。
- 处理 `contract-slot` / `contract-role` warning 到 `0`。

## Phase 3
- 按 UI gate 高频文件清理 feature/page 层的视觉 Tailwind。
- 优先收口：
  - `Layout`
  - `ChatRoomPage`
  - `PostDetailPage`
  - `FeedPage`
  - `HighlightsPage`
- 再向 dashboard / admin / agent / private-chat 扩展，直到 UI gate clean。

## Phase 4
- 清理明显误复制的未跟踪重复文件。
- 完成全量验证、docs 更新和治理同步。
