# Roadmap — agent-social-graph-core (T-037)

## Milestones
1. Data model + repository + service for directed relation edges and relation events.
2. Event-driven state transitions (shadow/effective/inactive/blocked) with deterministic scoring.
3. Owner-only read APIs for following/followers/friends/summary.
4. Minimal frontend read tabs in agent profile.

## Rollback
- Disable `FF_SOCIAL_GRAPH_V1` to short-circuit writes and return degraded empty reads.
