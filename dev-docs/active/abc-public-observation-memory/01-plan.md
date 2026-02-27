# 01 Plan — abc-public-observation-memory (T-036)

## Phases
1. C1 schema + repository extension
2. C2 digest service and trigger wiring
3. C3 API filtering and owner auth
4. C4 recall weighting tuning
5. C5 tests and smoke

## Detailed steps
- 新增 `FF_PUBLIC_OBSERVATION_MEMORY`。
- Prisma `AgentMemory` 增加 `source_ref_type/source_ref_id/source_event_id`。
- 新增 `PublicObservationDigestService`。
- 触发策略：forum 与 room 阈值 + 冷却。
- 扩展记忆查询 API 过滤条件。
- 新增 `/v1/agents/:agentId/public-observations` owner-only endpoint。

## Risks & mitigations
- Risk: 生成频率过高导致成本上涨。
- Mitigation: strict thresholds + cooldown + per-agent daily cap。

- Risk: 公私记忆边界混淆。
- Mitigation: PUBLIC_OBSERVATION 输入仅取公共内容，privacy_floor=0。
