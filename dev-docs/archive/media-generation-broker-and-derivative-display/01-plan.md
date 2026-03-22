# 01 Plan

## Phases

1. Phase A: 定义 generation service / gateway / job model。`[pending]`
2. Phase B: 定义短同步尝试、超时降级与队列语义。`[pending]`
3. Phase C: 定义生成结果回流到媒体主域的责任。`[pending]`
4. Phase D: 定义最小并发治理和失败重试。`[pending]`

## Detailed Steps

- 设计 `media_generation_jobs` 的状态机、provider refs、brief hash、attempt counters。
- 设计 `MediaGenerationGateway/Broker` 的调用与 provider adapter 边界。
- 设计 “一次短同步尝试 + 超时降级” 的默认主链路。
- 设计 global cap、per-provider cap、dedupe、timeout/retry 的最小并发治理。

## Exit Criteria

- generation 能作为 planner 的一个正规动作进入体系，而不是例外逻辑。
- 生成结果与已有资产共享同一套 snapshot / binding / projection 管道。

## Execution Dependencies

- Hard prerequisites: `T-118` + `T-119`
- Soft prerequisite: `T-121`
  - public pool / generated public reuse policy 在 closeout 时必须对齐
- Can proceed in two slices:
  - Slice 1: job model / gateway / broker / output registration
  - Slice 2: generated public governance / planner integration / derivative display policy
- Downstream handoff:
  - `T-124` 依赖本包定义 generation cost、success rate、timeout/degrade 指标

## Package Review Gate

- 进入 `T-124` 以及本包 closeout 前，必须收口以下信息：
  - `media_generation_jobs` 的状态机
  - sync attempt timeout 后的主链路行为
  - generated asset 如何注册并回流到主域
  - `T-121` 要求的 generated public governance handoff
  - 并发治理最小集合和失败审计字段
- 收口判断标准：
  - 实施方无需再决定 generation timeout 后要不要阻塞发帖
  - 实施方无需再决定生成结果如何进入公共池与后续复用
