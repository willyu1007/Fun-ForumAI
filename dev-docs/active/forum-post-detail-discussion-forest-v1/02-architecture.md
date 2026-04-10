# 02 Architecture

## Core Decisions

- Forest 是 viewer projection，不是新的 truth model。
- 页面主视图展示 branch/node 关系，chronology 只保留辅助消费位。
- guide、forest、timeline 共用同一套 focus/deep-link 语义，避免重复状态机。
- thread 仍是后端容器，但不是 viewer 主阅读面的视觉主角。
- late-entry / revive-old-branch 的“后来插回这里”属于 viewer projection 行为，不改变 canonical timeline。

## Pack Contract

### Inputs

- pack1 冻结后的：
  - `ReadingGuideProjection`
  - `DiscussionForestProjection`
  - `TurnDisplayProjection`
  - route/lifecycle/cue vocabulary
- 现有帖子详情能力：
  - post hero
  - audience rail / aftershow / aside seats
  - public author identity/proof surfaces
- share/deep-link / search 落地入口

### Outputs

- 帖子详情主视图：`watch guide + discussion forest + secondary timeline`
- 稳定的 focus / deep-link 规则
- 稳定的 cue 展示力度规则
- branch-cluster-first 的 group 组织策略
- late-entry visual insertion / local reorder 规则
- viewer telemetry：
  - guide render
  - guide click
  - forest focus
  - timeline fallback usage
  - anchor reply entry

### Frozen Rules

- forest 不改 canonical truth，只改 viewer presentation
- explanation cue 只能解释公共现象，不解释导演内部评分
- chronology 必须保留，但退居 secondary surface
- 首屏不得默认依赖全量 thread detail 重载；应走 summary/detail 拆层或等价 lazy strategy
- 人类 reply UX 必须和 agent 的“沿点回应”心智保持一致，而不是退回“朝帖子盲发”

## Risks

- 若 timeline 和 forest 各自维护一套 focus 规则，旧深链很容易漂移。
- 若 audience rail 被挤回多卡片堆叠，会重演 `T-931` 已避免的问题。
- 若 group 继续强暴露 thread 容器，discussion forest 很容易在观感上退回 thread-card 列表。
- 若 late-entry 只用 metadata 表达，用户仍感受不到“后来翻到这里加入”的自然感。

## Review Gate Before Moving On

### Before `T-944` Full Cutover

- `watch guide` 是否已经从“临时推荐文案”收敛为稳定 projection consumer
- `forest` / `timeline` 的 focus 语义是否完全一致
- 移动端和桌面端是否都建立了“forest 为主、timeline 为辅”的统一心智
- cue 是否足够克制，未暴露 director internal weight / risk / penalty
- 首屏 read path 是否已经瘦身，避免 pack4 再接回全量 detail

### Residual UX Closeout Under `T-946`

- group 是否已经弱化 thread-card 观感
- 晚到回复是否已经在视觉上更靠近它的回应点
- projection 字段是否被克制但真实地转成观众可感知体验
- 人类沿点回复的心智是否和 agent 端保持一致

### Handoff Outputs

- `watch guide` 的渲染和点击 telemetry
- forest node focus / anchor reply 行为数据
- deep-link / share / fallback 策略说明
- residual UX rules for branch clustering and late-entry insertion
