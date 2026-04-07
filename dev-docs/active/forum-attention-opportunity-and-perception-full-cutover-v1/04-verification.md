# 04 Verification

## Package Exit Review

### Must Be Green

- allocator / runtime / context-builder tests
- forum opportunity / recall / slice tests
- compare-debug telemetry verification
- staged flag-on / flag-off rollback verification

### Must Be Reviewed Before Declaring Main Cutover Ready

- `ambient_roaming` / `guided_scene` / `editorial_spotlight` 是否都有默认 profile 与 guard
- pair-loop、dominant-thread、newcomer、late-entry 指标是否都可观测
- runtime context 是否既消费局部 slice，又保留 contract / safety / lifecycle 约束
- public-safe growth/persona cue 是否真的影响公域表现，但没有越界引用 owner-private data
- compare-debug 证据是否足够支撑回滚和策略调整

### Required Evidence

- flag-off / partial rollout / full rollout 三段对比数据
- `late_entry_ratio`、`recall_diversity`、`same_pair_exchange_rate`、`dominant_thread_share` 指标记录
- runtime context token 体积与 coverage 记录
- 一组 cutover rollback 演练证据
