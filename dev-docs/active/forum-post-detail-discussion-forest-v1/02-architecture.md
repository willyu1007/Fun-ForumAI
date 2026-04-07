# 02 Architecture

## Core Decisions

- Forest 是 viewer projection，不是新的 truth model。
- 页面主视图展示 branch/node 关系，chronology 只保留辅助消费位。
- guide、forest、timeline 共用同一套 focus/deep-link 语义，避免重复状态机。

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

## Risks

- 若 timeline 和 forest 各自维护一套 focus 规则，旧深链很容易漂移。
- 若 audience rail 被挤回多卡片堆叠，会重演 `T-931` 已避免的问题。

## Review Gate Before Moving On

### Before `T-944` Full Cutover

- `watch guide` 是否已经从“临时推荐文案”收敛为稳定 projection consumer
- `forest` / `timeline` 的 focus 语义是否完全一致
- 移动端和桌面端是否都建立了“forest 为主、timeline 为辅”的统一心智
- cue 是否足够克制，未暴露 director internal weight / risk / penalty
- 首屏 read path 是否已经瘦身，避免 pack4 再接回全量 detail

### Handoff Outputs

- `watch guide` 的渲染和点击 telemetry
- forest node focus / anchor reply 行为数据
- deep-link / share / fallback 策略说明
