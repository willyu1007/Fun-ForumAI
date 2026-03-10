# 05 Pitfalls — chatroom-ux-audit-remediation

- 2026-03-11 | kind 新镜像一上线就 CrashLoop：`ERR_MODULE_NOT_FOUND: Cannot find package 'dotenv'`
  - Symptom: local-kind rollout 时新 pod 启动即退，日志停在 `src/backend/server.ts` 导入 `dotenv` 失败。
  - Root cause: 为了让 `.env.local` 在 dev 环境更早生效，`server.ts` 被改成了运行时静态 import `dotenv`；但 `dotenv` 仍在 `devDependencies`，production/k8s 镜像用 `pnpm install --prod` 根本不会装这个包。
  - What was tried: 先怀疑是 kind 镜像未刷新或 port-forward 噪音；对 crash pod 拉日志后才确认是运行时依赖问题。
  - Fix / workaround: `server.ts` 改为仅在 `.env.local` 存在时懒加载 `dotenv`，避免 production 路径触发模块解析。
  - Prevention: 任何“只为本地 dev 环境服务”的启动依赖都不要用静态 runtime import，尤其是在 production image 走 `--prod` 安装时。

- 2026-03-11 | kind rollout 第二次 crash：缺少 `room_programs` / membership 新列
  - Symptom: 修完 `dotenv` 后，新 pod 在仓库代码启动阶段报 Prisma `P2021/P2022`，提示 `room_programs` 表不存在、`room_memberships` 缺列。
  - Root cause: local-kind Postgres 只跑着旧 schema，T-073/T-075 相关 Prisma migrations 从未打到集群 DB。
  - What was tried: 先看作 rollout 噪音；随后对 kind Postgres 端口转发并执行 `pnpm db:migrate:status`，确认有 4 个 pending migrations。
  - Fix / workaround: 对 `postgresql://postgres:postgres@127.0.0.1:55432/llm_forum` 执行 `pnpm db:migrate:deploy`，再重启 deployment。
  - Prevention: local-kind 压测前先跑一次 `db:migrate:status`，不要在 `--skip-db-migrate` 前提下默认假设集群库已经跟上 repo schema。

- 2026-03-11 | owner 手动 cue 已落库，但房间现场不动
  - Symptom: `POST /v1/rooms/:id/program/cues` 返回 201 且 control-state 中存在 `PROGRAM_CUE / PLANNED`，但 40s 内没有任何 agent 接球发言。
  - Root cause: `ChatroomControlService` 会创建手动 `PLANNED` cue，但 `ConversationClock -> RoomProgramEngine.planNextTurn()` 只会重新“规划下一拍”，完全不消费已经存在的 `PLANNED` event/beat。
  - What was tried: 先怀疑多 pod 计时器或 leader 选举；查看 control-state 与日志后确认 pending cue 一直留在库里，根因落在 `RoomProgramEngine`。
  - Fix / workaround: `RoomProgramEngine` 增加优先复用当前 episode 上已有 `PLANNED` cue 的逻辑，并补回归测试。
  - Prevention: 任何“owner 先落库、runtime 后消费”的节目化事件，都要有针对 pending-state 消费的测试，不能只测 planner 创建成功。

- 2026-03-11 | 聊天室压测数据被 agent 房间上限污染
  - Symptom: 第一轮 3 房间并发压测里，有 1 个房间在 join guest 时直接返回 `Agent has reached the maximum of 3 rooms`，导致结果混入了测试数据噪音。
  - Root cause: 反复做房间 smoke 后，最早那批 active agents 已经被塞进多个房间；压测脚本按 agent 列表头部直接取样，没先检查 room occupancy。
  - What was tried: 先看成聊天室 runtime 回归；回查 `/v1/agents/:id/rooms` 后才确认是测试样本已脏。
  - Fix / workaround: 第二轮压测先筛掉高占用 agent，再重新跑 3 房间并发。
  - Prevention: 做聊天室并发压测前，先根据 `/v1/agents/:id/rooms` 过滤低占用 agent，避免把业务上限误判成 runtime 故障。
