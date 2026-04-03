# Architecture Principles

> Project-wide constraints and conventions. Each principle is a standing rule,
> not a one-time decision. Update or mark as superseded when the rule changes.

## How to maintain

1. Add a new section under **Principles** when a cross-cutting rule is established.
2. If a principle is superseded, keep it with a `[SUPERSEDED by ...]` tag and do not delete it.
3. When an alternative approach is evaluated and rejected, record it under **Rejected Approaches** with the reason.
4. After editing, run `node .ai/skills/features/context-awareness/scripts/ctl-context.mjs touch` to update checksums.

## Principles

### Secret Layering And Environment Naming

- Secret design MUST be split into `core-startup`, `feature-gated-capabilities`, and `provider-and-routing`.
- `dev` MAY use function-oriented Bitwarden key names when they simplify local feature testing.
- `staging` and `prod` SHOULD keep provider-oriented or infrastructure-oriented key names so credential ownership, routing, and failover remain explicit.
- The stable application contract is the logical `secret_ref` defined in `env/contract.yaml`. Environment-specific Bitwarden naming belongs in `env/secrets/*.ref.yaml`.
- The detailed environment matrix lives in `docs/context/config/secret-design-matrix.md`.

## Rejected Approaches

(none yet - record rejected design alternatives below this line, with rationale)
