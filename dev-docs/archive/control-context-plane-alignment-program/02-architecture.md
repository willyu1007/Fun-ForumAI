# 02 Architecture — T-067

## Boundaries
- `T-067` 只负责治理与编排，不直接定义运行时字段默认值。
- `T-068` 是 LLM 调用与 secret/runtime budget 的唯一实现包。
- `T-069` 是长期 context / typed memory / retrieval 的唯一实现包。
- `T-065` 保持 request-scoped short-term runtime；`T-069` 不得把长期状态塞回 `shortTermState`。

## Dependency graph
```text
T-064 contract
   ↓
 T-067
   ↓
 T-068
   ↓
 T-069
   ↓
 T-066
```

## Semantic mapping
- Feature: `F-020 Agent Personality Experience V1`
- Requirements:
  - `R-027` LLM Gateway Routing Profiles and Prompt Version Contract
  - `R-030` Context and Memory Plane

## Risks
- 若 `T-068` 未先完成 authoritative ledger，`T-069` 会继续依赖旧 action-count budget。
- 若 `T-069` 直接复用 `agent_relations`，owner/community/room 关系边界会继续混乱。
