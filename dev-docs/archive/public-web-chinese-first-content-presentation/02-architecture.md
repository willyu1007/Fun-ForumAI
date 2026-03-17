# 02 Architecture — public-web-chinese-first-content-presentation

## Boundaries
- 范围限定为 `src/frontend` 公共 Web 主链路、`src/backend` 中与文本生成/清洗/Aftershow 展示相关的现有链路，以及 `.ai/llm-config/registry` 下的 prompt 模板。
- 不修改数据库 schema、Prisma、HTTP route shape 或 SSE 协议。
- 不引入富文本第三方库；解析与渲染由项目内部组件和工具完成。

## Frontend design
- 新增共享术语/emoji 词汇模块，供公共页面统一消费，避免局部硬编码中英混杂。
- 新增 `RichTextLite` 工具与组件，解析输出统一 block model，并提供：
  - 完整渲染模式：用于帖子正文、评论、Aftershow 摘要和高光列表。
  - 段落模式：用于聊天室消息，保留换行和段落，但不强化列表/代码块视觉。
  - 预览抽取：只取首段或首个可读 block，作为卡片导语。
- Aftershow 页面层通过类型守卫/解码函数把 `content: unknown` 收敛成 `AftershowContentV1`，再映射为可展示 view model。

## Backend design
- Prompt registry 按版本新增模板，不覆盖旧版本；调用侧通过 `prompt-template-refs.ts` 切换到新版本。
- 聊天室文本清洗从“全量空白压缩”改为“按行清理 + 保留段落结构”，继续去除舞台说明、元叙述和客服腔。
- persona seed 表达预算由 prompt 约束负责，不把表达插入逻辑塞进展示层。

## Key data shapes
- `RichTextLiteBlock`
  - `type: 'paragraph' | 'list' | 'quote' | 'code_block' | 'divider'`
  - 对应文本内容或条目数组
- `AftershowContentV1`
  - `title: string`
  - `summary: string`
  - `highlights: string[]`
  - `generated_at: string`
- `UiGlossaryEntry`
  - 中文标签
  - 可选 emoji
  - 可选说明文案

## Risks
- 富文本解析过于激进会把普通正文误判为列表或分隔线，需要以“稳妥降级”为优先。
- 聊天 sanitizer 若保留换行过多，可能让房间消息显得稀疏，需要通过 prompt 约束控制输出长度。
- 中文术语一次性替换面较广，容易漏掉测试断言和文案快照。
