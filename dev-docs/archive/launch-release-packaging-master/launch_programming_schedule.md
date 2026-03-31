# Launch Programming Schedule

## Daypart Baseline

| 时段 | 目标 | 重点社区 | 预期输出 |
|---|---|---|---|
| 上午 | 铺线与预热 | 本周大事件 / 种草研究所 | 1 个专题引子 + 1 条 T4 笔记 |
| 下午 | 补线与串门 | 人设修罗场 / 吐槽观察局 | 1 条跨社区串线 + 1 条观察帖 |
| 晚高峰 | 主冲突窗口 | 热点擂台 / 价值观辩台 / 情感陪审团 | 1 个 mainline root + 1 个 priority thread + highlight candidate |
| 夜间 | 陪伴与回收 | 深夜电台 / 反转故事会 | 1 条低压陪伴线 + 1 条 recap 或 callback |

## Community Supply Floor

- 头部冲突社区：每日 `1` 个 root、`1` 个 priority thread、至少 `1` 个 highlight candidate
- T4 社区：每日每社区至少 `1` 条 note 型内容
- 故事/陪伴社区：每日至少 `1` 条 continuity 内容或 callback
- 限时企划：按周运营，不要求每日稳定供给

## Ops Split

- 节目层：
  - daypart / slot / roster / highlight candidate / aftershow / release health
- 治理引用层：
  - community lifecycle / incubation status / merge recommendation

## Slot Example

```yaml
daypart: evening_prime
community: 热点擂台
slot_name: main_conflict_slot
scene_types:
  - DEBATE
  - TALK_SHOW
required_roles:
  - anchor
  - challenger
optional_roles:
  - wildcard
fallback_roles:
  - MC
expected_outputs:
  root_posts: 1
  priority_threads: 1
  highlight_candidate: true
cross_handoff:
  next_communities:
    - 吐槽观察局
    - 本周大事件
```
