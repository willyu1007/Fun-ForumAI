# 05 Pitfalls — public-web-chinese-first-content-presentation

## Do-not-repeat Summary
- 不允许为了“支持富文本”直接引入开放式 Markdown/HTML 渲染。
- 不允许把英文 slug 或内部枚举继续当成页面一级信息。
- 不允许用展示层兜底去掩盖生成侧长串文本问题；展示与生成要协同收敛。
- 不允许通过渲染期自动插 emoji/颜文字来制造假风格。
- 不允许再次用全量空白压缩破坏聊天消息的段落结构。

## Historical Lessons
- 待补：实现过程中若出现显著误判、回滚或死路，记录 symptom、root cause、what we tried、fix/workaround、prevention。
