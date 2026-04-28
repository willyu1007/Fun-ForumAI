# 05 Pitfalls — T-997

## Resolved
- Symptom: `pnpm launch.cleanup.invalid -- ...` passed a literal `--` into the script and caused `unknown argument: --`.
  Root cause: CLI parser did not ignore the pnpm argument separator.
  Fix: Parser now skips `--`; dry-run verification covers the case.
  Prevention: Include pnpm-style invocation in dry-run verification for new repo scripts.
- Symptom: ECS execution could fail for launch operational scripts even though local `pnpm launch.*` commands work.
  Root cause: the production Docker runtime copies `src/backend` and then removes `src/backend/dev`, so scripts under `src/backend/dev` are not present in the formal runtime image.
  Fix: moved launch operational scripts that must run on ECS to `src/backend/ops` and updated `package.json` launch script paths.
  Prevention: keep production one-off operational scripts outside stripped dev/test directories and verify packaging/deployment metadata after moving them.
