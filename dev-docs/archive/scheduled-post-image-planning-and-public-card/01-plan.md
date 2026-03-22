# 01 Plan

## Phases

1. Phase A: 定义 `VisualDirective` 与 planner 候选源。`[pending]`
2. Phase B: 定义 `ImagePlan`、public card 与 write instruction 变化。`[pending]`
3. Phase C: 设计 prompt injection、serialization、token budget 与 display attach 顺序。`[pending]`
4. Phase D: 确认 wave 1 fallback、审计与读侧验收。`[pending]`

## Detailed Steps

- 在 scene selection 之后插入 `VisualDirectiveService`。
- 由 `ImagePlannerService` 对候选图做选择、降级或留空。
- 定义 `PublicMediaContextCard` 作为唯一 public prompt-safe 图片对象。
- 扩展 `WriteInstruction` 与 public write payload，支持 `image_plan_id`、`display_attachment_refs`。
- 定义 `serializePublicCardForPrompt()` 的文本形状、裁剪优先级、最大 token 占用和注入失败时的降级。
- 明确 `text_only`、`runtime_only_no_display` 等 fallback。

## Exit Criteria

- root post 能在不改变 public/private 边界的前提下稳定带图。
- `T-119` 的输出可以直接被后续 `T-121` 和 `T-122` 复用。
- public card 注入不会把 prompt 预算挤爆，并且有审计证据可验证没有泄漏 raw private data。

## Execution Dependencies

- Hard prerequisite: `T-118`
- Parallel window:
  - 可与 `T-120` 并行推进
  - 但两包必须共享 `T-118` 的 binding/projection contract
- Downstream handoff:
  - `T-121` 依赖本包冻结 public card / planner source / display attach 语义
  - `T-122` 依赖本包冻结 generation 入口在 planner 里的位置
  - `T-123` 依赖本包提供 root post 作为首个已验证 adapter 模板
  - `T-124` 依赖本包定义带图率和 public prompt audit 的核心指标事件

## Package Review Gate

- 进入 `T-121` / `T-122` / `T-123` 前，必须收口以下信息：
  - `VisualDirective` 到 `ImagePlan` 的职责切分，不允许导演层直接选择 asset
  - `ImagePlan` 的稳定子集：`status`、`decision`、`runtime.cards`、`display.attachments`、`generation`、`planner_audit.fallback_action`
  - `PublicMediaContextCard` 的序列化模板、裁剪顺序、最大 prompt 占用
  - `WriteInstruction.image_plan_id` 和 `display_attachment_refs` 的 writer 责任
  - `text_only` / `runtime_only_no_display` / `skip_scene` 的 fallback 触发条件
- 收口判断标准：
  - 实施方无需再决定 public prompt 到底吃什么文本
  - 实施方无需再决定帖子写入成功后如何挂图和如何降级
