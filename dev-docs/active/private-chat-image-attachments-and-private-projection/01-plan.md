# 01 Plan

## Phases

1. Phase A: 定义 private attachment send/read contract。`[pending]`
2. Phase B: 设计 private binding 和 runtime card。`[pending]`
3. Phase C: 设计 memory projection 和 public reuse handoff。`[pending]`
4. Phase D: 定义 private chat Web 输入/展示最小 UI contract。`[pending]`
5. Phase E: 验证私图默认不公开且不重复跑 vision。`[pending]`

## Detailed Steps

- 为 private chat message contract 增加 `attachment_asset_ids`。
- 设计 `private_message` scene binding 与 source kind `private_message_upload`。
- 设计最小版 private runtime card 与 memory projection。
- 设计 public planner 后续可读取的 public-safe shadow/projection，而不是直接读取 raw private attachment。
- 定义 private chat composer 的上传入口、attachment list、消息展示位和错误/降级状态。

## Exit Criteria

- 私聊图片能稳定进入 runtime 和 memory，而不是停留在 display 层。
- 后续 `T-121` / `T-119` 可以复用本包的 projection contract。
- 私聊图片能力不是纯后端 contract，而是有明确可实现的 Web 输入/展示接口。

## Execution Dependencies

- Hard prerequisite: `T-118`
- Parallel window:
  - 可与 `T-119` 并行
  - 但 private projection 字段不得脱离 `T-118` 的主域 contract 自行扩张
- Downstream handoff:
  - `T-121` 依赖本包冻结 private-to-public policy handoff 和 private-safe projection 形状
  - `T-123` 依赖本包冻结 chat-like surface 的 attachment / display 基础模式
  - `T-124` 依赖本包定义 private leak、private-origin projection usage 等指标口径

## Package Review Gate

- 进入 `T-121` / `T-123` 前，必须收口以下信息：
  - private chat send/read DTO
  - `PrivateMediaRuntimeCard` 的最小字段集合
  - `PrivateMediaMemoryProjection` 的最小字段集合
  - public reuse handoff 需要哪些字段，例如 `public_reuse_default`、`public_safe_shadow_hint`、`policy`
  - composer / message bubble 的最小 UI 行为
- 收口判断标准：
  - 实施方无需再决定私聊图片如何进入 runtime / memory
  - 实施方无需再决定后续 public planner 读取的到底是 raw private asset 还是 private-safe projection
