# 05 Pitfalls — search-analytics-backfill-and-compat-cleanup (T-146)

## Do-not-repeat summary

- Do not let search explanation keep using legacy mixed reason buckets once identity/projection/proof are split.
- Do not backfill new semantic fields without an explicit rollback and compat removal story.
- Do not leave front-end heuristics alive after canonical search and analytics fields exist.
