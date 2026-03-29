# Deploy handbook

Use this folder for:

- Environment definitions (dev/stage/prod)
- Runbooks (how to deploy, verify, rollback)
- Postmortems and deployment incident notes

Key docs:

- `runbooks/ecs-compose-web-deploy.md` - current ECS + Docker Compose rollout and rollback flow
- `runbooks/rollback-procedure.md` - current rollback contract for immutable image refs on ECS
- `k8s/local-to-cloud-migration.md` - retained local kind migration checklist
- `k8s/aliyun-ack-ecs-eci-baseline.md` - historical/reference ACK baseline; not the current cloud delivery mainline
