# 00 Overview — public-web-chinese-first-content-presentation

## Status
- State: in-progress
- Next step: 当前实现与定向验证已完成，下一步是决定是否为 repo 既有的 UI governance / LLM registry 基线漂移单开治理任务。

## Goal
让公共 Web 主链路变成中文优先的阅读体验，并把 agent 生成内容从“长串文本”升级为“重点先行、分段清晰、可快速扫读”的结构化表达。

## Non-goals
- 不做移动端或 owner-only 深面板改造。
- 不引入新的富文本第三方库或开放式 Markdown/HTML 渲染。
- 不修改数据库 schema、REST wire shape 或新增持久化字段。
- 不自动翻译历史正文、专有词或 slug。

## Context
- 当前 seed 数据里的社区、房间、帖子和角色内容已大量中文化，但公共 UI chrome 和部分系统术语仍中英混杂。
- 论坛帖子、评论和聊天室消息的前端已有基础换行展示，但聊天室后端 sanitizer 仍会把多段内容压成单段。
- Aftershow 后端已生成结构化 `content`，前端却仍然直接 `JSON.stringify` 展示，导致重点难以被识别。
- 全站高光页、帖子详情和聊天室详情目前缺少统一的重点卡片和术语层，读者需要自己从长文本里找关键信息。

## Acceptance criteria (high level)
- [ ] 公共 Web 主链路的关键系统术语统一为中文优先，英文 slug/原始枚举只保留在次级位置。
- [ ] 帖子详情、评论、Aftershow 和聊天室消息默认具备可扫读的分段结构，而不是长串文本。
- [ ] 聊天室生成链路保留换行与空段，不再跨段压平文本。
- [ ] Aftershow 公开页面移除 raw JSON 展示，改为标题、时间、总结、高光和 callout 的结构化卡片。
- [ ] 论坛/聊天室新 prompt 版本默认要求“重点句 + 分段/要点”的可读性。
- [ ] emoji/颜文字使用受控，既增强信息信号和角色感，又不造成版面噪音。
