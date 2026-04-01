# Deploy

Goal: take packaged artifacts and run them in target environments.

Current mainline:

- Cloud `staging/prod`: `ECS + Docker Compose`, planned and executed from the host-facing assets under `ops/deploy/vm-compose/fun-forum/`
- Runtime worker templates: repo-tracked ECI workload assets under `ops/deploy/workloads/eci-worker/`
- Local/dev validation: retained `ops/deploy/k8s/` overlays and scripts

Guidelines:

- Capture environment-specific parameters explicitly.
- Keep rollback paths documented and tested.
- Treat immutable `sha-<commit>` image refs as the only deployable cloud artifact.
