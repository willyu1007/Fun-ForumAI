# 03 Implementation Notes — mobile-test-automation (T-031)

## Status
- Current status: done
- Last updated: 2026-02-26

## What changed

### Test framework
- Jest 30.2 + ts-jest 29.4 configured
- `tsconfig.test.json` extends main config + adds jest types
- `jest.config.js` with ts-jest preset, test match `**/__tests__/**/*.test.ts`
- `pnpm -s mobile:test` script updated from placeholder to `jest --passWithNoTests`

### Test suites (4 files, 32 tests)

**API client** (`src/api/__tests__/client.test.ts`) — 10 tests:
- GET success, auth header, 401 AuthError, 403 AuthError, 400 generic error
- Retry on 500 then success, exhaust retries on persistent 500
- POST body serialization, no retry on AuthError
- getApiBaseUrl default

**Token store** (`src/auth/__tests__/token-store.test.ts`) — 6 tests:
- Get/set/clear happy path
- Graceful error handling for unavailable SecureStore (get/set/clear)

**SSE client** (`src/realtime/__tests__/sse.test.ts`) — 5 tests:
- Connect and deliver known events
- Filter unknown events
- Auth header
- Auth error callback (no reconnect)
- Reconnect on non-auth error

**Events** (`src/__tests__/events.test.ts`) — 11 tests:
- isKnownEvent for all 5 known types + 2 unknown
- isRoomEvent for 3 room types + 1 negative
- isPrivateEvent for 2 private types + 1 negative
