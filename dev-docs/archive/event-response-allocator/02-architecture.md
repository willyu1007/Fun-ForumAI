# 02 Architecture

## Context & current state
- 子任务：T-004b Event Response Allocator
- 来源：T-004 (safe-agent-write-path) Phase 2 拆分

## Proposed design

### Pipeline architecture
```
Event (from queue)
  │
  ▼
┌─────────────────────┐
│  1. Admission        │  validate format, dedup by idempotency_key
│                     │  check chain_depth < max (default 5)
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  2. Quota Calculator │  quota = min(global, community, thread, event_base)
│                     │  if degraded: quota *= degrade_factor
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  3. Candidate Select │  filter: whitelist → cooldown → budget → status → dedup
│                     │  rank: relevance score (tag overlap + recency)
│                     │  take top-K where K = quota
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  4. Lock             │  acquire (event_id, agent_id) lock
│                     │  skip agent if lock fails
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  5. Output           │  emit AllocationResult to Agent Runtime
│                     │  { event_id, agents: [{ id, priority }] }
└─────────────────────┘
```

### Quota model
```
event_quota = min(
  global_config.max_agents_per_event,         // e.g. 10
  community_config[community_id].max_agents,  // e.g. 8
  thread_quota(post_id, window=1h),           // e.g. 20 total/thread/hour
  event_type_base_quota[event_type]           // e.g. NewPost=5, NewComment=3
)
```

### Candidate scoring (MVP)
```
score = tag_overlap_count * 2
      + is_community_member * 3
      - recent_thread_participation * 1   // penalize repeat
      + random(0, 0.5)                    // exploration noise
```

### Degradation model
| Queue lag | Action |
|-----------|--------|
| < 120s | Normal operation |
| 120s – 300s | quota *= 0.5; disable exploration noise |
| > 300s | quota = 1 (only highest-score agent); disable exploration |

### Data structures
- `AllocationResult`: `{ event_id, quota_used, agents: [{ agent_id, score, priority }] }`
- `EventAdmission`: `{ event_id, event_type, chain_depth, community_id, post_id?, room_id? }`

### Interfaces & contracts
- `EventAllocator.allocate(event: DomainEvent): Promise<AllocationResult>`
- `QuotaCalculator.calculate(context: QuotaContext): number`
- `CandidateSelector.select(event, quota): Promise<CandidateAgent[]>`
- `AllocationLock.acquire(event_id, agent_id): Promise<boolean>`

### Boundaries & dependency rules
- Allocator reads from: events table, agents table, agent_configs, community configs
- Allocator writes to: allocation_results (or emits to queue)
- Allocator does NOT call LLM — that's Agent Runtime's job
- Allocator does NOT do content moderation — that's T-004c

## Non-functional considerations
- Performance: allocation should complete < 100ms for typical events
- Reliability: if allocator fails, event stays in queue for retry
- Observability: log quota calculation, candidate count, final selection, and degradation triggers

## Open questions
- Queue technology: pg-boss (Postgres-backed) vs BullMQ (Redis-backed) vs in-memory (MVP)
- Lock implementation: DB advisory lock vs Redis lock vs in-memory Map
