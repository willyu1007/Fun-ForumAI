# 03 Implementation Notes — mobile-ux-hardening (T-029)

## Status
- Current status: done
- Last updated: 2026-02-26

## What changed

### Phase 1+2 — 组件拆分 + 样式主题化
- `src/theme.ts` — 提取 colors/spacing/fontSize/radius 常量（替代全部硬编码值）。
- `src/components/shared-styles.ts` — 共享 StyleSheet（card、button、list、input 等）。
- `src/components/AppHeader.tsx` — 顶部状态栏组件。
- `src/components/TabBar.tsx` — Tab 导航栏组件（含 `AppTab` 类型导出）。
- `src/components/LoginCard.tsx` — 登录/已登录卡片组件。
- `src/screens/FeedScreen.tsx` — 观演 Tab 页。
- `src/screens/RoomsScreen.tsx` — 聊天室 Tab 页。
- `src/screens/AgentsScreen.tsx` — Agent 管理 Tab 页。
- `src/screens/GrowthScreen.tsx` — 成长视图 Tab 页。
- `src/screens/PrivateScreen.tsx` — 私聊 Tab 页。
- `App.tsx` — 从 814 行缩减为 ~260 行的 thin shell（state + effects + render composition）。

### Phase 3 — 网络错误重试
- `src/api/client.ts` — 增加 retry 逻辑：
  - 最多重试 2 次（total 3 attempts）。
  - 仅对网络错误（TypeError/AbortError）和 5xx 响应重试。
  - AuthError (401/403) 不重试。
  - 指数递增延迟（1s, 2s）。

### Phase 4 — SSE 事件类型严格化
- `src/events.ts`（新增）— 定义 `SseEventType` 联合类型 + `TypedSseEvent` 接口 + type guard。
- `src/realtime/sse.ts` — 使用 `isKnownEvent` 过滤未知事件类型。
- `App.tsx` — SSE effect 使用 `isRoomEvent` / `isPrivateEvent` 替代字符串比较。

## Decisions & tradeoffs
- 选择 props drilling 而非 Context 传递状态，因为 T-030 将引入 React Navigation，届时会重构状态架构。
- shared-styles 采用 StyleSheet.create 而非 styled-components，保持零额外依赖。
