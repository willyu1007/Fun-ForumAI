# 02 Architecture — T-039

- Event dedup by unique `idempotency_key`.
- Relation row concurrency guarded by `version` compare-and-set updates.
- Reconcile reads active/shadow edges and re-evaluates transitions.
