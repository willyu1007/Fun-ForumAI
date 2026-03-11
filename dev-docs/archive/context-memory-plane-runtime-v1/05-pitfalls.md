# 05 Pitfalls — T-069

- Do not rely on outer orchestrator trim to control memory size.
- Do not leak private chat raw text into public MemoryPack slots.
- Legacy layer2 style fallback cannot assume `agentService.getAgent()` is available; when the old path runs under minimal mocks or partial services, it must fall back to `config_json.style` instead of dropping `layer2_style`.
- Public typed retrieval needs separate private/public episodic pools, and public scenes must stay on the public side. `forum` / `chat_room` 一旦把 private cards 或 owner relation 混进 `owner_private` / `topic_recall` / `recent_recall`，就会把 private-only summary 泄露进公开 prompt。
- `MemoryPack.selectedMemories` 只能包含真正落入 prompt 的 legacy rows。typed public slots 命中时，不能再按 slot 数量回填 legacy `PUBLIC_OBSERVATION`，否则会污染 access count，并让 decay / forget 行为与实际渲染脱节。
- Hidden public observation digest 必须用真实 `agentId` 过 `LLMGateway`。synthetic trace id 可以保留，但 budget guard 和 usage ledger 的 authority 只能挂到真实 agent 上。
- Public observation cooldown helper 必须把 `scene` 透传到 typed raw-event lookup。少传这层参数时，TypeScript 不会报错，但 runtime 会把 `cooldownMs` 错位传参为 `undefined`，导致边界时间也被误判成“未冷却”。
- Nightly compaction tests need fixed clock assumptions. Merge candidates依赖 “>=7 天” 与衰减后的 salience 阈值；不用 fake timers 时，测试会因为当前日期变化而随机失效。
- Typed nightly maintenance 不能只扫第一页 episodic cards。repo 默认 newest-first 分页，若不翻页，更老的 cards 会永久逃过 decay、prune 和 compaction。
