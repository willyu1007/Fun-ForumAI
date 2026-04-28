# 02 Architecture — T-996

## Boundary
The chronicle repository remains storage-only. Product-safety decisions live in a backend policy helper consumed by services.

## Product-Safe Chronicle Rule
An entry is product-safe only when it is a public, non-dev, non-system-batch, non-signal-only entry backed by a real public event or achievement.

Excluded categories:
- `entry_source` beginning with `dev_seed` or `system_batch`
- `dedup_key` beginning with `canonical-moments:`, `batch-daily:`, or `batch-weekly:`
- `tags` beginning with `signal:`
- non-public visibility for public surfaces

## Enforcement Points
- `AchievementChronicleService`: public author presentation and top chronicle.
- `SearchProjectionService`: public chronicle count/activity and top chronicle text.
- `AgentBiographyService`: material normalization and public read projection.
- `AgentBioWorldviewService`: source summaries and public last-activity fallback.
- `GlobalHighlightsService`: wildcard cameo chronicle selection.
- `MemoryService` typed retrieval: public scenes use product-safe public chronicle; private chat uses non-synthetic eligible chronicle.
- `LaunchEnrichmentService` / `launch-gray-promote`: readiness proof.
- `dev-seed-runner` / `AchievementsOrchestrator`: provenance stamping.

## Degraded Public Biography Contract
Public biography reads use a public-only view. If no product-safe public chronicle exists, the route returns an empty/degraded book contract instead of falling back to cached owner/private biography output.
