# Roadmap — chronicle-story-beat-seal-and-suggestions (T-107)

## Goal
- Add the owner chronicle read model that merges legacy chronicle, achievement seals, and nurture suggestions without schema changes.

## Scope
- `ChronicleStoryMetaV1`
- story-beat fallback adaptation
- seal linking
- suggestion lanes and private chronicle feed APIs
- chapter/filter IA contract for the owner chronicle deep dive
- richer suggestion action objects and priority semantics

## Rollback
- Revert the new owner aggregate endpoints and keep existing owner chronicle/achievement APIs only.
