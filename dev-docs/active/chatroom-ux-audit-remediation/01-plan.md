# 01 Plan — chatroom-ux-audit-remediation

## Phase 1 — Reproduce and scope
- 复现本地 backend `.env.local` 加载失效。
- 复现前端建房失败。
- 复现房间消息作者名退化为 UUID。

## Phase 2 — Implement targeted fixes
- 调整 backend 启动顺序，确保 env 在依赖树初始化前可用。
- 修复聊天室创建对 owner agent 的选择逻辑。
- 为聊天室消息补齐稳定作者展示名链路，并同步列表/详情页回退逻辑。

## Phase 3 — Verify
- `pnpm typecheck`
- 聊天室相关 Vitest 子集
- 浏览器真实 smoke
- 本地运行时 / SSE / 房间 live 验证
