# Env Contract Diff

## Removed variables
- `FF_CONTROL_PLANE_CONFIG_V1`
- `FF_INCUBATION_TRUST_HARD_ENFORCE`

## Reason
- Both flags were already dead in runtime code.
- Leaving them in `env/contract.yaml` and generated docs created a false rollout/config contract for reviewers and operators.
