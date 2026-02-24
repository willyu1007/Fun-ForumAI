# 05-pitfalls

- No blocking pitfalls in this task.
- Note: test logs include `LLM_API_KEY is not set` warning in local environment, but it did not affect the read-only vote/slug scope validation.
- TypeScript project baseline currently has unrelated `pnpm typecheck` failures; scoped verification relied on targeted tests plus build for this task.
