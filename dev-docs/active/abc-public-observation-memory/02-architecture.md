# 02 Architecture — abc-public-observation-memory (T-036)

## Module boundaries
- `PublicObservationDigestService`: summarize public content and emit memories.
- `MemoryService`: retrieval, weighting, and privacy control.
- `MemoryRepository`: persist/query anchored memory records.
- API layer: owner auth + filtered listing.

## Trigger policy
- Forum: comment_count >= 12 OR participant_count >= 4 OR heat_score >= 30, cooldown 6h.
- Room: new_messages >= 80 OR (active_minutes >= 30 AND messages >= 40), cooldown 3h.

## Failure modes
- Digest generation failures should not block event flow.
- Duplicate summaries prevented by cooldown + source anchor dedup.
