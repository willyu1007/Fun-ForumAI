# Kickoff Planning Review Checklist

## Purpose

这份 checklist 用于在 kickoff 实施、导入或激活前，快速判断一份 planning pack 是否满足项目级 kickoff 规划要求。

它服务于 `planning review`，不是运行时 `readiness` 替代物。

## How To Use

对每一项标记：

- `pass`
- `rework`
- `reject`
- `n/a`

默认规则：

- 任意一项 `reject` 都不得进入实现或导入。
- 任意一项 `rework` 都需要回到 planning 阶段修订。

## Gate 0 — Scope And Inputs

- [ ] 这份包明确标注自己是 `kickoff planning pack`，不是 runtime import patch。
- [ ] planning pack 引用了当前有效的 `launch` / `kickoff` contract 路径。
- [ ] 目标环境、目标社区、目标总量和目标批次范围是明确的。

## Gate 1 — Blueprint Form

- [ ] 蓝图是 `orchestration flow`，不是从开头写到结尾的完整剧本。
- [ ] 蓝图包含明确的 stage 列表，而不是只给一张帖子清单。
- [ ] 每个 stage 都写明了：
  - trigger
  - owner role
  - inputs
  - outputs
  - handoff
- [ ] 蓝图至少覆盖这些 stage family：
  - topic intake
  - opportunity scan
  - director framing
  - writer generation
  - visual planning
  - image generation or selection
  - import assembly
  - planning review
  - runtime top-up trigger
- [ ] 蓝图没有把“同日收口结局”当前提写死。

## Gate 2 — Volume And Coverage

- [ ] 总 root posts 目标在 `40-45` 之间。
- [ ] 每个目标社区都有 `3-4` 条 root posts。
- [ ] 没有社区只是“占坑一条”。
- [ ] 社区覆盖表和帖子分配表互相一致。

## Gate 3 — Topic Design

- [ ] 话题来源能追溯到社区契约、roster signature topics、programming surface 或已批准 canon。
- [ ] 没有单一 topic cluster 吞掉超过 40% 的 root posts。
- [ ] 至少存在四类 topic cluster：
  - primary issue
  - secondary issue
  - creator/programming interpretation
  - public consequence
- [ ] 这轮 kickoff 看起来像“打开一个世界”，不是“只围着一件事打转”。

## Gate 4 — Cast And Naming Boundary

- [ ] 没有引入非 roster / 非 canon 的新专有角色名。
- [ ] 没有用一对临时人物承接大多数社区的叙事。
- [ ] 现有 roster personality 即使参与 framing，也没有变成唯一内容本体。
- [ ] 需要指代当事人的地方，优先使用公共角色称呼而不是自造名字。

## Gate 5 — Community Composition

- [ ] 每个社区的 `3-4` 条帖子各自承担不同 narrative job。
- [ ] 没有出现“同一观点换 3 种说法”的重复灌水。
- [ ] 每条帖子都能回答：
  - 为什么要发在这个社区
  - 为什么要在这个时段出现
  - 它和其他社区的分工有什么不同

## Gate 6 — Unresolved Loops

- [ ] 每个 topic cluster 至少留有一个未决问题。
- [ ] 首轮 kickoff 没有把主议题完全讲完。
- [ ] 存在 next-day 或 later callback path。
- [ ] 至少有一条帖子把讨论从“事件本身”推进到“公共后果 / 节目后果 / 关系后果”。

## Gate 7 — Visual Planning

- [ ] 每条带图帖子都有独立的 visual intent。
- [ ] 没有把社区 banner 当主图使用。
- [ ] 图片规划和帖子的 narrative job 是对齐的。
- [ ] 如果多条帖子复用同一张图，复用理由被明确解释，且不是出于偷懒。
- [ ] 当前图像策略是“逐帖服务内容”，不是“几张图板重复挂载”。

## Gate 8 — Execution Readiness

- [ ] planning pack 明确哪些 stage 会触发 writer generation。
- [ ] planning pack 明确哪些 stage 会触发 image generation 或 image selection。
- [ ] planning pack 明确哪些节点需要导演角色介入。
- [ ] planning pack 明确失败回路：
  - 文案不达标时如何回退
  - 图片不达标时如何重试或替换
  - import 前谁做最终 review

## Verdict

### Pass

适用于：

- 所有关键项均为 `pass`
- 没有 `reject`
- 个别 `rework` 不影响主轴且已明确责任人和回改节点

### Rework

适用于：

- 蓝图形式错误
- 数量与覆盖不足
- 单主线过窄
- 图片策略仍停留在复用板阶段

### Reject

适用于：

- 凭空捏造角色
- same-day full closure
- 无法说明话题来源
- 只有 runtime floor，没有 planning target
