# 04 Verification — p1-lightweight-personalization-and-relation-hints (T-138)

## Planned Coverage

- 排序信号检查：不会破坏首发编辑化 shelf 基线。
- relation hint 检查：卡片、主线、aftershow 的关系提示一致。
- 候选池检查：`PprSnapshot` 先离线试运行，不直接统治线上排序。
- rollout 检查：personalization 出问题时可回退到 P0 基线排序。
