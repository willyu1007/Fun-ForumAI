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
1. 已用真实 `ForumReadService`、`MemoryService`、`DefaultContextJournalService`、`LlmSummaryOrchestrator`、`LlmIdentityFinalizer` 做 forum/chat-room smoke。
2. 已验证 public observation 从 domain event / room message 进入 typed plane 后，`getMemoriesForContext()` 会命中 public episodic slots。

### Phase 5 Rollout Gate
1. 已与 `T-066` 对齐 observability / eval / rollout gate。
2. 已为 public ingress 和 nightly compaction 增加 rollout 关注项：typed write 成功率、identity-write 调用稳定性、chronicle compaction 去重稳定性。

### Phase 6 Migration Cleanup
1. 已明确本轮 dual-read / dual-write 退场条件：读路径 typed-first，写路径保留 compatibility `AgentMemory`，退场依据迁移 fallback 指标另包推进。
2. 已补 public typed persistence cleanup tests，覆盖 typed-first dedup / cooldown / real ingress smoke。
3. 已在 public observation 路径实现 typed raw-event 优先去重与 cooldown，并将 legacy fallback 显式计入 migration metrics。

## Follow-up (non-blocking)

1. 若要彻底移除 public observation 的 legacy `AgentMemory` 双写，应新开迁移包，基于本轮新增的 migration/rollout metrics 做分阶段关停。
