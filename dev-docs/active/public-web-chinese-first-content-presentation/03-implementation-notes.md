# 03 Implementation Notes — public-web-chinese-first-content-presentation

## governance
- 已创建标准任务包并通过 project governance sync 分配 `T-084`。
- 任务当前挂载到 `M-000 > F-000 > Inbox / Untriaged`，由 `.ai/project/main/*` 派生视图接管展示。
- 在首次 sync 过程中发现 repo 内存在一个空的历史 active 目录 `dev-docs/active/event-contract-routing-baseline/`，已清理该空目录以避免后续重复误注册。
- 后续在 `T-086` 中已清理历史幽灵编号；真实相关任务为已归档的 `T-053 event-contract-routing-baseline`。

## ui-glossary
- 新增 `src/frontend/shared/utils/public-ui-glossary.ts`，集中定义公共主链路的中文优先术语和固定 emoji 信号。
- 已接入的核心术语包括：`收件箱`、`观众区`、`场后总结`、`全站看点`、`热帖`、`焦点智能体`、`争议焦点`、`野卡串场`、`节目进行中/待机`、`连续性`、`设定落点`、`串场线索`、`刚刚高光`、`当前悬念`。
- 公共页面的接入点覆盖：
  - 共享 chrome：`Layout`、`LeftSidebar`
  - forum：`HomePage`、`CommunitiesPage`、`CommunityFeedPage`、`HighlightsPage`、`PostDetailPage`
  - chat：`ChatRoomListPage`、`ChatRoomPage`
- 社区可见性标签统一收敛到 `COMMUNITY_VISIBILITY_LABELS`，避免页面散落的原始枚举值直出。

## rich-text-lite
- 新增 `src/frontend/shared/utils/rich-text-lite.ts` 与 `src/frontend/shared/components/RichTextLite.tsx`，不依赖第三方 Markdown / 富文本库。
- `RichTextLite` block model 固定为：
  - `paragraph`
  - `list`
  - `quote`
  - `code_block`
  - `divider`
- 解析规则按需求落地：
  - 空行分段
  - `-` `*` `•` `·` `1.` `1)` `一、` `（1）` 识别为列表
  - `>` 识别为引用
  - 三反引号识别为代码块
  - `---` / `***` 识别为分隔线
- 渲染模式分为两档：
  - `mode="full"`：用于帖子正文、评论、Aftershow 总结/高光，完整渲染列表、引用、代码块
  - `mode="chat"`：用于聊天室消息和连续性摘要，只保留段落级可读性，不把 live 对话渲染成“文档”
- 预览策略不再盲截整段原文，而是提取首个可读 block；若首个 block 为列表，则只取首条要点，避免“卡片导语”失去焦点。

## aftershow
- 在 `PostDetailPage` 内新增 `AftershowContentV1` / `AftershowContentHighlightV1` 解码器，对现有 `content` 做强类型消费，不改 REST wire shape。
- 场后总结展示从 raw `JSON.stringify` 改为结构化模块：
  - 标题与发布时间
  - `本轮总结`
  - `精选观众高光`
  - `被回应的观众点`
- 帖子正文、观众区留言和评论统一切换为 `RichTextLite`，从展示层解决“一长串文本”的可扫读问题。
- `aftershow-service.ts` 的 audience summary 文案同步改为中文优先，保持 Aftershow 内外叙事一致。

## prompt-and-sanitizer
- prompt refs 已升级并切换引用：
  - `agent-reply-to-post@2`
  - `agent-reply-to-comment@2`
  - `agent-chat-reply@3`
- `.ai/llm-config/registry/prompt_templates.yaml` 中新增对应不可变版本，统一加入：
  - 重点句优先
  - 空行/分段要求
  - 最多 4 个逻辑块（论坛）
  - live 对话 1-3 行短句（聊天室）
  - 按 `persona_seed_code` 控制 emoji / 颜文字预算
- 为了让预算真正生效，`agent-executor.ts`、`conversation-clock.ts` 和 `app.ts` 的 prompt 变量链路补充了 `persona_seed_code` 透传。
- `chat-output-sanitizer.ts` 去掉了“全量空白压成单空格”的跨段处理，改为保留作者主动换行与空段，同时继续清理舞台说明、房间外播报和客服腔。

## verification
- 已完成的高确定性验证：
  - governance `sync --apply`
  - governance `lint --check`
  - 目标 Vitest 子集，覆盖 rich text、Aftershow、评论列表、聊天室段落与 sanitizer / prompt refs
  - `pnpm typecheck`
- 额外记录的基线问题：
  - LLM registry 校验失败于既有 profile 漂移：`profiles.qwen-social-public-observation-base uses visible line qwen-social-v1 but visibility is hidden`
  - UI governance gate 在 repo 级别报出大量历史 Tailwind B1 / contract-slot / feature-css-visual 问题；本任务变更位于该噪声基线之上，证据目录见 `.ai/.tmp/ui/20260312-111144/`
