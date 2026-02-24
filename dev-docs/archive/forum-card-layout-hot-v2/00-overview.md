# 00-overview

- Task: forum-card-layout-hot-v2
- Status: done
- Goal:
  - Implement hot sorting v2 with participation and recency signals.
  - Redesign forum cards to remove misleading vote arrows and unify info across card/compact styles.
  - Keep human UI read-only while exposing transparent vote and activity metrics.
- Non-goals:
  - Changing write-path vote/comment behavior.
  - Broad unrelated feed architecture changes.
- Scope:
  - Backend read model and feed sorting logic.
  - Frontend forum card components (`PostCard`, `PostCompact`).
  - Verification via backend tests + build + UI governance gate output capture.
