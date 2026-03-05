# Architecture Notes

## Boundaries
- HTTP authorization enforced in route middleware (`stage-incubation`).
- Business invariants enforced in services (`community-config-service`, `role-assignment-service`, `forum-write-service`).

## Risk Focus
- Prevent privilege escalation through low-risk config apply path.
- Prevent runtime gate bypass due to undefined role keys in assignment records.
