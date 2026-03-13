# 04 Verification

## Executed verification commands

| Command | Result |
| --- | --- |
| `pnpm exec vitest run src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/CommentList.test.tsx src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass |
| `pnpm exec vitest run src/backend/services/__tests__/hot-topic-policy-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/room-discovery-service.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/community-config-service.test.ts src/backend/services/__tests__/governance-adapter.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts` | pass |
| `pnpm exec eslint src/backend/services/chat-service.ts src/backend/services/forum-read-service.ts src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/frontend/shared/utils/hot-topic-policy.ts src/frontend/shared/utils/__tests__/hot-topic-policy.test.ts src/frontend/features/forum/pages/CommunityFeedPage.tsx src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/features/forum/components/CommentList.tsx src/frontend/features/chat/pages/ChatRoomPage.tsx src/frontend/features/user/pages/SafetyCenterPage.tsx src/frontend/features/admin/pages/AdminPanel.tsx src/frontend/features/private-chat/pages/PrivateChatPage.tsx src/frontend/shared/components/Layout.tsx` | pass |
| `pnpm exec vitest run src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/frontend/shared/utils/__tests__/hot-topic-policy.test.ts src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/CommentList.test.tsx src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx src/frontend/shared/components/__tests__/Layout.test.tsx` | pass |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --repo-root . --run-id t091-hot-topic-fixes-20260313 --evidence-root .ai/.tmp/ui --mode full --fail-on errors` | pass |
| `pnpm vitest run src/backend/services/__tests__/hot-topic-policy-config.test.ts src/backend/services/__tests__/hot-topic-policy-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/routes/__tests__/admin-hot-topic-api.test.ts` | pass |
| `pnpm vitest run src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/private-chat/pages/__tests__/PrivateChatPage.test.tsx src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx src/frontend/shared/components/__tests__/Layout.test.tsx` | pass |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --repo-root . --run-id t087-closeout-20260313c --evidence-root .ai/.tmp/ui --mode full --fail-on errors` | pass |

## Coverage notes

- backend:
  - `hot-topic-policy-config.test.ts`
  - `hot-topic-policy-service.test.ts`
  - `policy-gateway-service.test.ts`
  - `forum-read-service.test.ts`
  - `room-discovery-service.test.ts`
  - `chat-service.watchability.test.ts`
  - `community-config-service.test.ts`
  - `governance-adapter.test.ts`
  - `chat-service.policy-gateway.test.ts`
  - `forum-write-service.policy-gateway.test.ts`
- frontend:
  - `CommunityFeedPage.test.tsx`
  - `PostDetailPage.test.tsx`
  - `CommentList.test.tsx`
  - `ChatRoomPages.test.tsx`
  - `SafetyCenterPage.test.tsx`
  - `AdminPanel.test.tsx`
  - `PrivateChatPage.test.tsx`
  - `Layout.test.tsx`
  - `hot-topic-policy.test.ts`

## Evidence

- UI governance gate report: `.ai/.tmp/ui/t091-hot-topic-fixes-20260313/ui-gate-report.md`
- closeout gate report: `.ai/.tmp/ui/t087-closeout-20260313c/ui-gate-report.md`
