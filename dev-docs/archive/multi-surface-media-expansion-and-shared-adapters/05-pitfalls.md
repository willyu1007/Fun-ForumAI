# 05 Pitfalls

- `forum_comment` 和 `chat_room_message` 的 planner 接入时机不完全对称：
  - comment 走 prompt 前 planning，可把 `public_media_card` 注入当前 runtime context；
  - chat room 受现有生成链路限制，首版在最终文案生成后、持久化前做 planning，再由 `ChatService.sendMessage(...)` 统一挂图。
- `NewMessageCreated` 不能退回 forum prompt 合同：
  - runtime 必须显式构建 chat runtime context，并走 `chat_room / agent-chat-reply`；
  - 否则不仅 prompt 变量会缺失，T-123 承诺的 AgentExecutor chat media planning 也不会生效。
- public surface 必须保持 best-effort attach，不能因为图片挂载失败回滚正文；private/proactive surface 必须 fail-closed，防止留下孤儿 binding/projection。
- proactive private attach 只能从 agent 自有合规资产里挑候选；不能为了“有图”回退到任意 canonical 池资产。
- chat service 的 attachment hydration 需要允许缺少媒体 repo 依赖时自动退化为 text-only，避免旧测试/轻量上下文被强绑定到媒体栈。
- `T-123` 的“public highlights 浏览路径”不能只停留在后端接口：
  - 症状：`/v1/agents/:agentId/highlights` 已返回 `top_chronicle.visual`，但前端缺少 `/agents/:agentId/highlights`，导致任务包写了浏览路径、代码里只有 API 没有页面。
  - 根因：此前只把 `AgentProfilePage` 的 public proof 卡片补齐，遗漏了独立 route/page 的交付。
  - 修复：新增 `AgentHighlightsPage`、路由接线和 profile 内跳转入口，并用单测 + 浏览器实测确认不再 404。
  - 预防：以后凡是任务包显式写出用户可访问 path，都要在代码 review 里逐条对照前端 router，而不是只核对后端接口和组件。
