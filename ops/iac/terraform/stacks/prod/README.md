# stack: prod

Composes the production versions of:

- `network`
- `entry_https`
- `compute_ecs_web`
- `compute_eci_worker`
- `data_postgres`
- `data_redis`
- `storage_media`
- `dns_cert`

Prod stack handoff must satisfy ALB HTTPS, DNS, certificate binding, and ICP
readiness before public traffic cutover.

Files:

- `versions.tf` / `providers.tf`
- `main.tf`
- `variables.tf`
- `outputs.tf`
- `backend.hcl.example`
- `terraform.tfvars.example`

Ownership boundary:

- State backend and infrastructure resources are platform/operator owned.
- Application release, env-file injection, and runtime credential delivery remain outside Terraform.
- `runbook_handoff` is the minimum prod output surface expected by `cloud-go-live-chain.md` and the `T-936` promote gate.
