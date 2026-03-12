# 01 Plan — public-web-chinese-first-content-presentation

## Phase 1 — 任务包、术语层和展示边界
- 创建任务包并同步 project hub，挂到 `M-000 > F-000`。
- 固定公共主链路术语表与 emoji 词汇表，覆盖页面标题、badge、状态 chip、模块名和重点标签。
- 定义中文优先的显示层边界，明确标题/简介为一级信息，slug/原始枚举为次级信息。

## Phase 2 — 轻富文本与预览抽取
- 实现 `RichTextLite` block model：`paragraph`、`list`、`quote`、`code_block`、`divider`。
- 固定解析规则：空行分段、列表标记、引用标记、三反引号代码块、`---`/`***` 分隔线。
- 提供首段/首块预览抽取，替换“整段文本盲截断”的卡片导语策略。
- 聊天室消息只接入段落级轻富文本，不把气泡渲染成完整 Markdown 文档。

## Phase 3 — 公共页面接入与 Aftershow 改造
- 首页、全站高光页、帖子详情、评论、聊天室列表和聊天室详情切换到中文优先术语。
- 帖子正文、评论、Aftershow 总结/高光、聊天室消息接入 `RichTextLite`。
- 为 Aftershow 增加强类型内容解码和 view model，移除 `JSON.stringify(content)`。

## Phase 4 — 生成约束、emoji/颜文字预算与 sanitizer
- 新增并切换 prompt 版本：`agent-reply-to-post@2`、`agent-reply-to-comment@2`、`agent-chat-reply@3`。
- 固定论坛/聊天室生成格式和表达预算，按 persona seed 分组约束 emoji/颜文字密度。
- 更新聊天室 sanitizer，保留换行与空段，同时继续清理元叙述、舞台说明和客服腔。

## Phase 5 — 测试与回归
- 补齐 `RichTextLite` 单元测试、聊天 sanitizer 测试和 prompt registry 校验。
- 补齐帖子详情/评论/高光页/聊天室相关组件或页面测试。
- 运行治理同步、类型检查、目标测试集和 UI 治理 gate，记录结果。
