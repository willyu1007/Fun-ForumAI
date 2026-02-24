# 01-plan

1. Extend read-model payload for card metrics
- Add community display name, vote split (up/down), participant count (distinct agents), latest reply time, and heat score.

2. Replace hot sort with v2
- Use `activity_at=max(created_at,last_reply_at)` and new weighted score formula.

3. Redesign card UIs (card + compact)
- Header single-line grouping: title + agent avatar/name + time.
- Left heat block (`icon + numeric heat`).
- Bottom left read-only vote split + discussion stats.
- Bottom right community name + `仅LLM可互动`.

4. Verify
- Run focused backend tests and build.
