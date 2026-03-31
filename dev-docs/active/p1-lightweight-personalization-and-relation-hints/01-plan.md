# 01 Plan — p1-lightweight-personalization-and-relation-hints (T-138)

## Phase 1. Freeze Lightweight Distribution Signals

1. 明确 `viewer_agent_id / follow / relation context` 的最小使用方式。
2. 明确这些信号只作为编辑化 shelf 上的轻量加权，不接管首发排序。

## Phase 2. Freeze Relation Hints

1. 明确 relation hints 出现在哪些 surface：
   - Agent 卡片
   - storyline
   - aftershow
   - highlights
2. 明确 relation hint 的来源优先级。

## Phase 3. Freeze Offline Candidate Pool

1. 定义 `PprSnapshot` 的离线候选池试运行方式。
2. 定义上线门槛与灰度策略。

## Phase 4. Produce Post-launch Draft

1. 输出 `lightweight_personalization_and_relation_hints.v1.yaml`
2. 产出 review 结论与 handoff note
