# Maintenance-Window Preflight Summary — 2026-04-11

## Scope

This preflight package covers the first real-environment rollout step for `T-952 flag-metadata-legacy-cutover`:

- target environment selection
- rollback / backup prerequisites
- exact execution order
- go / no-go conditions

It is a rollout planning artifact only. No target-environment DB or deploy action is executed by this package.

## Default rollout target

- default target: `staging`
- `prod` is explicitly out of scope for the first window
- `prod` remains blocked until:
  - staging DB apply succeeds
  - staging deploy + smoke checks succeed
  - an operator gives explicit prod approval

Reason:

- repo deployment guidance marks both `staging` and `prod` as approval-gated
- the current staging topology is the only place where the same-host temporary worker flow is documented and testable

## Release compatibility classification

This rollout must be treated as:

- `db_compat=incompatible`

Reason:

- the generated migration at `prisma/migrations/20260411043037_t952_flag_metadata_legacy_cutover/migration.sql` drops live columns and tables, including:
  - `DROP COLUMN ... meta_json`
  - `DROP COLUMN ... moderation_metadata_json`
  - `DROP TABLE "agent_inclination_assets"`
  - `DROP TABLE "legacy_growth_events_archive"`

Operational consequence:

- image-only rollback is not sufficient
- before the window starts, operator must have a separate DB recovery reference such as:
  - managed DB snapshot id
  - restore ticket id
  - approved recovery runbook note

## Required operator inputs

Before the window opens, all of the following must exist:

1. immutable published image ref
   - local `llm-forum:ci-validate` is build evidence only
   - real rollout artifact must be an immutable ACR image:
     - `talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-<40-char-commit>`
2. target environment
   - `staging`
3. operator access
   - ECS shell access
   - ACR read-only pull credentials
   - Bitwarden / env rendering access
4. DB recovery reference
   - required because `db_compat=incompatible`
5. ingress-side write freeze plan
   - this repo does not provide a dedicated maintenance/write-freeze toggle
   - maintenance window must rely on operator-controlled ingress drain, maintenance page, or accepted brief downtime at the ALB/Caddy layer

## Canonical execution order

1. publish immutable image ref
2. compile env from secrets / values
3. inject `.env` onto ECS
4. record desired release with `db_compat=incompatible`
5. confirm DB recovery reference and rollback owner
6. freeze or drain new ingress writes
7. execute `deploy.sh --with-migrate`
8. verify web health and `smoke.sh`
9. on staging, restart the same-host worker with the same immutable image
10. mark targets applied and record evidence

## Exit criteria for preflight completion

This step is considered complete when:

- staging is chosen as the first rollout target
- the incompatible DB classification is explicitly accepted
- the DB recovery reference requirement is documented
- a go / no-go matrix exists
- the exact operator command sheet exists and matches the repo runbooks/scripts

All of those conditions are now satisfied.
