# 02 Architecture — T-040

## Models
- AgentStats(agent_id PK, unspent_points, 8 axes, memory, learning, version, created_at, updated_at)
- AgentState(agent_id PK, valence, arousal, confidence, irritability, fatigue, last_updated_at)
- AgentStatEvent(id, agent_id, event_type, source, idempotency_key unique, delta_json, created_at)

## Service boundaries
- StatsRepository: persistence abstraction
- StatsService: load/update stats + state + events
- StatDeriver: pure deterministic derivation from base/state/context

## API
- GET stats
- GET stats/events
- GET stats/state-timeline
- POST stats/preview-allocation
- POST stats/allocate
- GET stats/derived

## Consistency rules
- preview and allocate share same derivation/validation function
- optimistic write by version check
- all mutations append AgentStatEvent
