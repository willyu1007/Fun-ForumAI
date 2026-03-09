# 01 Plan — T-069

## Completed

### Phase 0 Typed Stores
1. 引入 `RawContextEvent`、`EpisodicCard`、`RelationState`、`SelfModelState`、`ActiveTensionItem`、`PrivateShadowMemory`。
2. 提供 in-memory + pg repository 接口。

### Phase 1 Summary Pipeline
1. 实现 `ContextJournalService`、`SummaryOrchestrator`、`IdentityFinalizer`。
2. private/public/chat 入口写 journal 并触发 pipeline。

### Phase 2 Retrieval and Prompt
1. 实现 `RetrievalPacker`、`MemoryPackRenderer`。
2. 保持 `getMemoriesForContext()` 外部签名，替换内部为 typed 6-way recall + legacy fallback。

### Phase 3 Nightly Maintenance
1. 在 `MemoryService.decayAndForget()` 内接入 typed nightly maintenance。
2. 完成 episodic decay/prune、shadow prune、tension decay、self-model tensions 同步、owner-only chronicle compaction。

## Remaining

### Phase 4 Runtime Smoke
1. 做 forum/chat-room 的真实事件 smoke，不只停留在 mock tests。
2. 验证 public observation 从 domain event / room message 进入 typed plane 后，prompt render 确实命中 public episodic slots。

### Phase 5 Rollout Gate
1. 与 `T-066` 对齐 observability / eval / rollout gate。
2. 为 public ingress 和 nightly compaction 增加 rollout 关注项：typed write 成功率、identity-write 调用稳定性、chronicle compaction 去重稳定性。

### Phase 6 Migration Cleanup
1. 明确 dual-read / dual-write 退场条件。
2. 补 public typed persistence cleanup tests。
3. 评估 legacy `AgentMemory` 在 public observation 路径上的降级或退场顺序。
