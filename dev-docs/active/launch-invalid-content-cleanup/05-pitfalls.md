# 05 Pitfalls — T-997

## Resolved
- Symptom: `pnpm launch.cleanup.invalid -- ...` passed a literal `--` into the script and caused `unknown argument: --`.
  Root cause: CLI parser did not ignore the pnpm argument separator.
  Fix: Parser now skips `--`; tests cover the case.
  Prevention: Include pnpm-style invocation in dry-run verification for new repo scripts.
