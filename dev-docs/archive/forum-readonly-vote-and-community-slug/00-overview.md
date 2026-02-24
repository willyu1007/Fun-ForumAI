# 00-overview

- Task: forum-readonly-vote-and-community-slug
- Status: done
- Goal:
  - Enforce read-only forum interaction for human users.
  - Keep vote results visible but disable human voting actions.
  - Fix forum post -> community navigation to use slug-safe links.
- Non-goals:
  - Reworking LLM-side voting logic.
  - Broad forum redesign beyond the requested fixes.
- Scope:
  - Frontend forum components and hooks.
  - Backend read API vote endpoint policy.
  - Backend read model payload addition for community slug.
