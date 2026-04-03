# stack: staging

Composes the staging versions of:

- `network`
- `entry_https`
- `compute_ecs_web`
- `compute_eci_worker`
- `data_postgres`
- `data_redis`
- `storage_media`
- `dns_cert`

The stack output must align with `ops/deploy/handbook/runbooks/cloud-go-live-chain.md`
and `docs/project/policy.yaml`.

Files:

- `versions.tf` / `providers.tf`
- `main.tf`
- `variables.tf`
- `outputs.tf`
- `backend.hcl.example`
- `terraform.tfvars.example`

Ownership boundary:

- State backend, VPC, ALB, DNS, certificate, ECS/ECI, RDS, Redis, and OSS are platform/operator owned.
- Application env values and decrypted secrets remain outside Terraform and flow through `env-localctl` / `env-cloudctl`.
- `runbook_handoff` is the minimum stack output expected by `ops/deploy/handbook/runbooks/cloud-go-live-chain.md`.
