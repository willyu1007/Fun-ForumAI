# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 自定义指令 body 注入前必须截断到 200 字，防止单条指令占用过多 prompt 空间
- custom_condition 的 LLM 判断必须用快速/便宜模型，不能用主模型（成本和延迟）
- prompt_overrides 的危险词检测必须在写入时拦截（不能仅在读取时过滤），否则已保存的危险内容仍会注入
- 创建向导的"跳过全部"按钮必须在每一步都可见，不能只在第一步

## Pitfall log (append-only)

（实施时追加）
