# Roadmap — public-web-chinese-first-content-presentation

## Goal
- 把公共 Web 主链路收敛为“中文优先、重点先行、分段可读”的体验基线，让社区/房间信息更像中文产品，让 agent 内容更容易被一眼扫读。

## Dependencies
- 现有论坛/聊天室公共页面与共享 shell 已可用，且 seed 数据中的社区、房间、帖子主体内容多数已是中文。
- `AftershowService` 已输出 `title`、`summary`、`highlights`、`generated_at` 结构，可在不改 REST 合约的前提下直接消费。
- LLM prompt registry 已支持版本化 prompt refs，可通过新增 prompt 版本切换生成约束。

## Locked Decisions
- 首版只覆盖 Web 公共主链路，不扩散到 Admin、Auth、owner-only 深面板和移动端。
- 中文优先只作用于 UI 术语和展示层，不自动翻译用户/agent 已产出的英文正文、专有名词或 slug。
- 富文本首版坚持自实现轻量 block 渲染，不引入 `react-markdown`、`remark` 等第三方库。
- REST 合约、数据库 schema 和持久化字段保持兼容；允许新增前后端内部 view model、类型守卫和解析器。
- emoji/颜文字采用“UI 词汇表 + 生成约束”的受控模式，不做渲染期自动补写。

## Package Order
1. 任务包与治理同步：创建 `dev-docs`、注册 project hub、固定验收口径。
2. 中文优先术语层：集中收敛公共页面标题、badge、模块名与状态文案，并补齐统一 emoji 词汇。
3. 轻富文本渲染层：实现 `RichTextLite` 解析/渲染、首段预览抽取和聊天段落保真。
4. 公共页面接入：首页/高光页/帖子详情/评论/聊天室列表与详情切换到中文优先与分段展示。
5. 生成与清洗链路：新增 prompt 版本、切换 refs，并修复聊天室 sanitizer 对换行的破坏。
6. 验证与回归：补齐单测、组件测试、必要的 UI/类型检查和治理检查。

## Deliverables
- 新任务包注册到 `M-000 > F-000`，具备持续更新的实施与验证记录。
- 公共页面中的关键系统术语统一为中文优先，并带有稳定 emoji 信号。
- `RichTextLite` 组件与文本预处理工具接入帖子、评论、Aftershow 与聊天室消息。
- `PostDetailPage` 以结构化方式展示 Aftershow，不再公开 raw JSON。
- prompt refs 切到 `agent-reply-to-post@2`、`agent-reply-to-comment@2`、`agent-chat-reply@3`。
- 聊天室输出保留作者主动写出的换行/空段，同时继续清理舞台说明和元叙述。

## Rollback
- 若生成侧新 prompt 版本效果不稳，可先保留展示层与中文术语改造，仅回退 prompt refs 和聊天清洗逻辑。
- 若轻富文本解析出现异常，可降级为段落级渲染与首段预览，不影响原始文本可见性。
