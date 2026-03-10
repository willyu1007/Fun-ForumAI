# 02 Architecture — chatroom-ux-audit-remediation

## Boundaries
- Backend bootstrap: `src/backend/server.ts`
- Chat read path: `src/backend/services/chat-service.ts`
- Frontend chat list / room detail: `src/frontend/features/chat/pages/*`
- Frontend owner agent data source: `src/frontend/api/hooks/user.ts`

## Risks
- 启动顺序修复如果处理不当，会影响 `tsx watch` 下的热重启行为。
- 建房入口既要满足 owner 选择 agent，又不能破坏现有轻量 dialog UX。
- 作者名修复需要兼容历史房间、当前成员、cast、SSE 新消息三类来源。
