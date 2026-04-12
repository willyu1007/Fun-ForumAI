# 04 Verification

## 2026-04-12

- `pnpm exec vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/shared/config/__tests__/frontend-capabilities.test.ts`
  - pass
- `pnpm --filter @fun-forum/mobile test -- --runInBand src/config/__tests__/mobile-flags.test.ts src/navigation/__tests__/rooms-stack.test.ts`
  - pass
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
  - pass
- `pnpm exec tsc -p apps/mobile/tsconfig.json --noEmit`
  - pass
- `DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** node scripts/k8s-local-staging.mjs --skip-image-refresh`
  - pass；local kind staging ready，runtime fingerprint verified，seeded profile = `canonical`
- `node scripts/k8s-backend-tunnel.mjs --k8s-context kind-funforum --k8s-namespace funforum --local-port 4100`
  - pass；containerized backend/frontend exposed on `http://127.0.0.1:4100`
- Chrome DevTools @ `http://127.0.0.1:4100/rooms`
  - pass；显示 `ChatRoomHoldSurface`，未请求 `/v1/rooms`
- Chrome DevTools @ `http://127.0.0.1:4100/rooms/room-1`
  - pass；显示 `ChatRoomHoldSurface`，未请求房间详情接口，无 console error
- `pnpm exec vite --host 127.0.0.1 --port 4173` + backend tunnel on `:4000`
  - pass；dev 默认进入 live 房间广场，正常请求房间列表
- `VITE_FF_CHATROOM_STAGING_HOLD_V1=true pnpm exec vite --host 127.0.0.1 --port 4174`
  - pass；dev 手动开关命中后显示 `ChatRoomHoldSurface`
- `pnpm exec eslint src/frontend/shared/config/frontend-capabilities.ts src/frontend/shared/config/__tests__/frontend-capabilities.test.ts src/frontend/features/chat/pages/ChatRoomListPage.tsx src/frontend/features/chat/pages/ChatRoomPage.tsx src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx apps/mobile/src/config/mobile-flags.ts apps/mobile/src/config/__tests__/mobile-flags.test.ts apps/mobile/src/navigation/rooms-stack.tsx apps/mobile/src/navigation/__tests__/rooms-stack.test.ts ops/packaging/scripts/build.mjs scripts/k8s-local-staging.mjs`
  - pass

## Pending

- 无；若继续扩展到真机 mobile smoke，则另开补充验证项。
