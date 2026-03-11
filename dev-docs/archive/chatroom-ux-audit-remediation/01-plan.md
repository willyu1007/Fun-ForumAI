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
- `pnpm -s exec tsc -b --pretty false`
- 聊天室相关 Vitest 子集
- 浏览器真实 smoke（`DevAuthToolbar` + `/rooms` + `/rooms/:roomId`）
- local-kind 双副本 smoke（T-023 ~ T-025 + 聊天室 3 房间并发 cue 消费）

## Phase 4 — Closeout
- 记录本轮 fail -> fix -> rerun 的证据与残余风险边界。
- 将 T-081 状态切到 `done`，明确内容质量问题转交 T-082。
- 归档 task bundle 并执行 project governance sync/lint。
