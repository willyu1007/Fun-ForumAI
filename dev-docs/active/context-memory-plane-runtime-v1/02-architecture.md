# 02 Architecture — T-069

## Boundaries
- 本包依赖 `T-068` 提供 hidden/director 与 identity-write lane。
- owner/community/room 关系不复用 `agent_relations`。
- `CommunityCultureDigest`、`ChronicleEntry` 继续复用现有 store。

## Data flow
```text
raw event
  -> context journal
  -> summary extract
  -> summary distill
  -> identity finalize
  -> typed stores
  -> retrieval packer
  -> MemoryPack renderer
  -> prompt layer
```

## Risks
- 若直接把长期状态写回 `AgentMemory` prose，会失去 typed retrieval 的意义。
- 若不保留 legacy fallback，现有历史 memory 会在切换当天失效。
