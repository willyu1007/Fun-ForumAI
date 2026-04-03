# ECI Worker Workload

Repo-tracked baseline assets for the runtime worker role.

Scope:

- Shared image with `llm-forum` web/ECS deploys
- ECI/container-group replacement rollout only
- No public ingress
- `RUNTIME_ENABLED=true` is mandatory for this role
- Secret injection is contract-driven and must cover the admitted multi-provider LLM surface used by runtime lanes
- Registry + execution policy remain the only cloud routing authority; env-level provider/model/base-url pins are intentionally excluded from this workload contract

Artifacts:

- `role-contract.yaml`
- `env-matrix.yaml`
- `staging.container-group.yaml`
- `prod.container-group.yaml`

Use these assets with the runbook:

- `ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md`
