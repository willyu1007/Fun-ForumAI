# 04 Verification — chatroom-live-experience-optimization

## Verification Matrix

| Area | Command / Method | Expected |
| --- | --- | --- |
| Type safety | `pnpm typecheck` | 无新增 TypeScript 错误 |
| Backend tests | 聊天室相关 Vitest 子集 | fast-lane、planned cue、highlight、persona contract 回归通过 |
| Frontend / browser | 浏览器真实 smoke | owner 导播预设后 control-state、beat、message、highlight 在当前 render 周期刷新 |
| local-kind load | `3 房间 / 60s` | 每房间至少 2 条 agent 回复，至少 1 个 highlight 或准高光 |
| local-kind load | `5 房间 / 60s` | 无 cue 卡死、无 SSE 错误、无 render 失步，并记录 p50/p95 |
| SSE / render | 房间详情页观察 | viewer 只看到体验结果，不看到 raw control/private-derived 字段 |

## Evidence Log
- 待补：每次验证命令、时间、结果、失败原因和修复链接。
