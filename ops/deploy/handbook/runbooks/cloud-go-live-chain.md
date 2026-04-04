# Cloud Go-Live Chain

## Scope

Canonical operator + infrastructure handoff for the cloud readiness layer that
sits underneath application deploys.

This runbook covers:

- ALB / HTTPS / DNS / certificate readiness
- ECS web and ECI worker target topology
- RDS PostgreSQL / Redis(Tair) / object storage readiness
- deploy-time secret injection boundaries
- ICP readiness as a public launch gate

## Resource readiness checklist

Before staging or prod application rollout:

1. `network`
   - VPC / vSwitch / security-group contract is known
   - ECS web and ECI worker subnets are decided
2. `entry_https`
   - ALB exists
   - HTTPS listener exists
   - backend routing to ECS web is defined
   - SSE-friendly timeout / streaming behavior is verified
3. `data_postgres`
   - endpoint / port / account handoff is available
   - DB compatibility strategy for the target image is recorded
4. `data_redis`
   - runtime queue / leader backend endpoint is available
   - SSE broadcast backend endpoint is available for multi-host rollout
5. `storage_media`
   - bucket / endpoint / access policy handoff is available
6. `dns_cert`
   - domain binding is prepared
   - certificate is issued or imported
   - DNS records are ready for ALB
7. compliance
   - ICP preparation is complete before public prod traffic cutover

## Injection model

- Policy authority
  - `docs/project/policy.yaml` is the only normal staging/prod routing authority.
  - `policy.env.cloud.require_target=true` means every `staging|prod x api|worker` action must resolve through an explicit target.
  - `env/inventory/staging.yaml` and `env/inventory/prod.yaml` remain legacy references only; do not use inventory fallback for normal rollout.
- ECS web
  - `env-localctl compile` renders env-file
  - `env-cloudctl --runtime-target ecs --workload api` plans/applies `envfile`
  - ECS host consumes `/srv/apps/fun-forum/.env`
  - `RUNTIME_ENABLED=false` stays compose-owned
  - staging-only bootstrap exception:
    - if formal deploy workspace is not ready yet, operator MAY compile locally and manually install `/srv/apps/fun-forum/.env`
    - this exception is only for `staging api`
    - it MUST NOT restore env-level routing pins
- ECI worker
  - `env-cloudctl --runtime-target ecs --workload worker` renders redacted container-group manifest
  - operator replaces container group using the rendered secret/env contract
  - runtime reads injected env only
  - `RUNTIME_ENABLED=true` stays workload-contract owned

## Routing guardrails

- Do not inject `LLM_PROVIDER`, `LLM_MODEL`, or `LLM_BASE_URL` into staging/prod cloud artifacts.
- Emergency routing changes must happen through registry/policy updates or provider admission/secret changes plus redeploy.
- Worker secret injection must include the full admitted primary + secondary provider surface required for ordered failover.

## Rollout order

1. Confirm cloud readiness checklist above
2. Publish immutable image ref
3. Compile env / secret injection artifacts
4. Inject API env-file through `env-cloudctl`
   - temporary staging exception: local compile + manual ECS import is allowed only until formal deploy workspace exists
5. Migrate database when required
6. Roll ECS web
7. Verify ALB -> ECS health and smoke checks
8. Render/apply ECI worker replacement contract
9. Verify worker health, queue backend, leader backend
10. Run staging live gates
11. Only after all gates pass, prepare prod promote

## References

- `ops/deploy/handbook/runbooks/deployment-mainline.md`
- `ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md`
- `ops/deploy/workloads/eci-worker/`
- `ops/iac/terraform/`
