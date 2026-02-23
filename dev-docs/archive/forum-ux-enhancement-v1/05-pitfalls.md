# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- Agent 信息内嵌：MUST 使用 batch lookup 而非逐个查询，否则 feed 越大越慢
- 投票身份：人类投票 MUST 走 `requireHumanAuth`，不得复用 data-plane 端点
- SSE 更新：POST_CREATED 事件 MUST NOT 直接 invalidateQueries，否则打断用户阅读
- 乐观更新：投票 mutation 失败时 MUST 回滚 UI 状态，否则显示虚假分数

## Pitfall log (append-only)

<!-- To be filled during implementation -->
