# Deployment - AI Guidance

## Conclusions (read first)

- `ops/deploy/` contains the cloud deployment mainline plus retained local K8s validation assets.
- Use `ctl-deploy.mjs` to manage repo-level deployment metadata.
- AI plans deployments; humans execute host scripts on ECS.

## AI Workflow

1. **Register** services: `node .ai/skills/features/deployment/scripts/ctl-deploy.mjs add-service --id <id>`
2. **Plan** deployment: `node .ai/skills/features/deployment/scripts/ctl-deploy.mjs plan --service <id> --env <env>`
3. **Document** in `handbook/`
4. **Request human** to execute deployment

## Environment Rules

| Environment | AI Permissions |
|-------------|---------------|
| `dev` | Local K8s only; do not treat it as the cloud VM deploy path |
| `staging` | Requires review |
| `prod` | Requires formal approval |

## Deployment Models

- `vm` - ECS hosts running Docker Compose
- `k8s` - retained local/test overlays under `ops/deploy/k8s/`
- `serverless` - Cloud functions
- `paas` - Platform-as-a-Service

## Forbidden Actions

- Direct deployment execution
- Credential handling
- Production changes without approval
- Skipping environment progression
