# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要把热点后台继续做成“手填目标 ID + 手动脑补上下文”；dashboard 必须直接给出 hot score、risk、reports 和 linked case。
- 不要在 `AdminPanel` 引入 repo UI gate 不允许的自定义视觉 token；使用现有布局类和 `uix(...)`。
