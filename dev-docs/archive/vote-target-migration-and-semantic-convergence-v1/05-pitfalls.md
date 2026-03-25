# 05 Pitfalls

## Do Not Repeat
- Do not assume `forum_scene_metadata.thread_id` can be populated for every `TURN` row. The table has a unique constraint on `thread_id`, so only `THREAD` sidecars should own that column; `TURN` sidecars must use `turn_id` only.
- When fixing enum drift in Prisma, verify both the migration chain and live DB data. This case failed because the DB was behind multiple migrations and still held legacy `COMMENT` values.
- If repo-facing names are converged but runtime config still accepts old aliases, the old terminology will keep leaking back into later work. Remove the compatibility layer once no environment files depend on it.
