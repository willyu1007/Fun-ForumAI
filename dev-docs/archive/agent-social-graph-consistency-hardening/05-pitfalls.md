# 05 Pitfalls — T-039

## Pitfall: auto-generated drift migration attempted to drop prior partial index
- Symptom: `prisma migrate dev` created an extra migration that included dropping historical partial unique index.
- Root cause: partial unique index from previous task cannot be fully represented in Prisma schema.
- Fix: kept intended social graph migration and removed the unintended extra migration artifact from task output.
- Prevention: avoid repeated `migrate dev` in environments with intentionally manual partial indexes; prefer `migrate deploy` for deterministic rollout.
