# T-960 Chatroom Staging Hold E2E Closure

- Status: `done`
- Owner: `codex`
- Started: `2026-04-12`
- Scope:
  - Close the chatroom hold rollout for web/mobile.
  - Verify real containerized staging behavior in retained `kind-funforum`.
  - Remove stale chatroom flag/testing leftovers that could cause dual-path ambiguity.
  - Archive the task after code, test, and browser verification pass.

## Why this task exists

聊天室在 staging 需要临时关闭，但 dev 仍要保留人工开关。如果只恢复页面占位而不收口 Docker/k8s 构建链、旧 flag 残留和真实环境验证，就会留下“本地 dev 正常、容器 staging 漂移”的双轨风险。

## Acceptance

- Web `staging` 容器化页面中，`/rooms` 与 `/rooms/:roomId` 都展示 hold 页面。
- Web `dev` 默认仍展示 live chatroom；手动打开 `VITE_FF_CHATROOM_STAGING_HOLD_V1` 后切到 hold 页面。
- Mobile 通过 `EXPO_PUBLIC_FF_CHATROOM_STAGING_HOLD_V1` 在 stack 顶层切换到 hold screen。
- 代码、测试、类型检查、lint、Chrome DevTools live verification 全部通过。
- 不留下旧 dev flags 孤儿测试、误生成治理文件或任务编号冲突。

## Outcome

- 保留并接通了 `ChatRoomHoldSurface`，让 web 列表页和详情页在 hold 打开时都统一短路到说明页。
- 新增 mobile 轻量 flag 读取与 hold screen，保证 mobile tab stack 的语义和 web 对齐。
- 修复了一个真实交付链缺口：Docker/k8s 前端构建现在会显式吃到 `VITE_FF_CHATROOM_STAGING_HOLD_V1`，因此 local-kind / staging rehearsal 不再与本地 Vite 漂移。
- 已在 `kind-funforum` + Chrome DevTools 下实测容器化 `http://127.0.0.1:4100/rooms` 与 `http://127.0.0.1:4100/rooms/room-1`，都正确显示 hold 页面且没有继续打房间接口。
- 已删除旧的 `DevFrontendFlagsPanel` 孤儿测试，并清理本轮治理同步误生成的无关 task artifacts。
