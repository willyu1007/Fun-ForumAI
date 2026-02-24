# 05-pitfalls

- `ui-governance-gate` command exits with code 2 in this repository baseline due many existing violations.
- The gate still writes useful evidence reports under `.ai/.tmp/ui/<run-id>/`; use those reports for scoped review instead of blocking feature delivery.
