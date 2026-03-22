# 01 Plan

## Phases

1. Phase A: 新 feature / requirement / task 治理落项。`[in-progress]`
2. Phase B: `T-118` 落媒体主域与 V1 语义修正。`[pending]`
3. Phase C: `T-119` 跑通 root post 的 public image planning 与 prompt-safe card。`[pending]`
4. Phase D: `T-120` 扩展 private chat attachment 与 private projection。`[pending]`
5. Phase E: `T-121` 和 `T-122` 分别完成复用治理与 generation broker。`[pending]`
6. Phase F: `T-123` 扩展 comment / chat room / proactive / achievement 等 surface。`[pending]`
7. Phase G: `T-124` 补 observability、lifecycle、带图率控制与 rollout。`[pending]`

## Detailed Steps

- 在 `.ai/project/main/registry.yaml` 中新增 `F-080`、`R-080` 至 `R-086`、`T-117` 至 `T-124`。
- 为 1 个总包和 7 个执行包建立标准 `dev-docs` bundle。
- 冻结 source governance：`platform_canonical`、`community_commons`、`owner_private_pool`、public archive、private uploads、generated assets。
- 冻结公共场景主链路：`scene -> visual directive -> image plan -> public media card -> prompt -> persist -> attach`。
- 冻结默认策略：私图默认不公开、策略关闭后阻断未来复用、generation 只做短同步尝试后超时降级。
- 为 Phase 5 surface 扩展新增独立执行包，覆盖 `forum_comment`、`chat_room_message`、主动聊天、成就系统 / episode props。
- 为指标、告警、垃圾回收、snapshot 版本升级、带图率控制新增独立执行包，避免产品放量后治理缺位。

## Execution Dependencies

### Hard order

1. `T-118` 先行。
2. `T-119` 在 `T-118` 的主域 contract、迁移策略、bridge 边界冻结后启动实现。
3. `T-120` 在 `T-118` 的 asset/snapshot/binding/projection contract 冻结后启动实现；可与 `T-119` 并行。
4. `T-121` 在 `T-119` 与 `T-120` 明确 public/private projection contract 后启动。
5. `T-122` 在 `T-119` 完成 planner/card 接线后启动；final policy alignment 依赖 `T-121`。
6. `T-123` 在 `T-119` 与 `T-120` 主链路稳定后启动；其 surface policy 复用 `T-121` 规则。
7. `T-124` 最晚冻结；指标定义可提前草拟，但 rollout gate、lifecycle、带图率控制必须基于 `T-119` 至 `T-123` 的实际输出。

### Parallel windows

- `T-119` 与 `T-120` 可并行，但共享 `T-118` 的主域 contract，不得各自发明 binding/projection 变体。
- `T-121` 与 `T-122` 可部分并行：
  - `T-122` 可先完成 generation job / gateway / broker 基础。
  - `T-121` 先冻结 `derived_public`、origin disclosure、cross-agent reuse policy。
  - 两包在 “generated public assets 如何进入公共池” 处汇合。
- `T-123` 可在 `T-121` 后半段介入 adapter 设计，但不得绕开其治理矩阵。
- `T-124` 可从 wave 1 开始预埋指标位，但 dashboard / controller / cleanup policy 以全链路 contract 为准。

### Recommended execution waves

1. Wave 0: `T-117` 治理冻结
2. Wave 1: `T-118`
3. Wave 2: `T-119` + `T-120`
4. Wave 3: `T-121` + `T-122`
5. Wave 4: `T-123`
6. Wave 5: `T-124`

## Exit Criteria

- project governance sync/lint 通过。
- 8 个 bundle 均能独立表达目标、边界、接口、验收和依赖。
- 实施方不需要再对 V1 语义、prompt contract、generation gateway 归属做额外决策。
