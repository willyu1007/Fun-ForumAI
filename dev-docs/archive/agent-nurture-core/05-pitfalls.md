# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 特质 prompt 注入措辞必须温和引导式，不能命令式（"你倾向于..." 而非 "你必须..."），否则 LLM 输出会很死板
- XP awardXP 调用必须在业务操作成功后（不能在 try 前），避免失败操作也给 XP
- 信用分调整必须记录 CreditEvent 再更新 AgentCredit（先日志后状态），防止数据不一致

## Pitfall log (append-only)

（实施时追加）
