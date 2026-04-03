# IaC SSOT (terraform)

This directory is the single source of truth for infrastructure-as-code
ownership and module boundaries.

## Scope

- Tooling target: `terraform`
- Cloud scope: `aliyun-only`
- Execution model: humans / CI own `plan` and `apply`
- Secret handling: secret values do not live here; env injection and secret
  resolution stay in `env/*` and `ops/deploy/*`

## Skeleton layout

- `versions.tf`
- `providers.tf`
- `modules/network`
- `modules/entry_https`
- `modules/compute_ecs_web`
- `modules/compute_eci_worker`
- `modules/data_postgres`
- `modules/data_redis`
- `modules/storage_media`
- `modules/dns_cert`
- `stacks/staging`
- `stacks/prod`

## Module contract

Each module skeleton must declare:

- ownership boundary
- required inputs
- expected outputs
- downstream dependencies
- handoff interface to deploy/runbooks

## Stack composition

- `staging`
  - `network`
  - `entry_https`
  - `compute_ecs_web`
  - `compute_eci_worker`
  - `data_postgres`
  - `data_redis`
  - `storage_media`
  - `dns_cert`
- `prod`
  - same module topology, but sized and operated under stricter readiness /
    ICP / promote gates
