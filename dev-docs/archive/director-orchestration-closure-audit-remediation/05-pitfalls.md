# 05 Pitfalls — T-098

- 本地环境漂移会伪装成“代码有 bug”：
  - `forum_scene_metadata` / `runtime_scene_states` migration 已在 repo 内存在，但若本地库未执行 `pnpm db:migrate:deploy`，真实 smoke 会直接失败。
- `dev-seed` 不是强保证把 scene-pool 房间补满：
  - 现有 seed agent 有 `max 3 rooms` 约束，重复 seed 时会出现 `Room seeding partial failure`；
  - 做 chatroom cue smoke 前，可能需要手动把 `洛芙蕾丝` / `辩论大师` 重新 join 进 `scene-pool-room-ai-consciousness`。
- chatroom 统计要区分“历史脏数据”和“修复后新 episode”：
  - `director-closure-report` 会如实统计库里的旧 `legacy_fallback` / `off` / `not_applicable` 行；
  - 若需要纯净 post-fix 指标，应清理旧数据或只过滤修复后的 episode 时间窗。
- 本轮没有补 editorial overlay 资产：
  - 这不是实现漏记，而是明确记录的剩余 omission；不要把当前 repo 状态解读为 overlay 已覆盖。
- 非目标噪音：
  - 只注入 DashScope key 时，部分 background digest / observation 路径仍可能出现与其他 provider 相关的 `AuthError` 日志；
  - 这不阻塞 T-098 的 forum / chatroom / runtime 闭环，但会影响日志可读性。
