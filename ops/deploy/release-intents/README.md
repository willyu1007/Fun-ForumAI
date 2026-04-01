# Release Intents

Repo-side desired release records for environments that may deploy later than the image publish event.

## Purpose

- Keep the canonical deployment input immutable: `sha-<40-char-commit>`
- Avoid relying on human memory when ECS / ECI replacement happens later
- Track whether `ecs_web` and `eci_worker` have both consumed the same desired image ref

## Layout

- `ops/deploy/release-intents/<env>/desired.json`
  - current desired release for the environment
- `ops/deploy/release-intents/<env>/history.jsonl`
  - append-only snapshots of desired release changes

## Contract

- Repo-side `desired.json` answers: "what should this environment deploy next?"
- Host-side `/srv/apps/<project>/releases/current.json` answers: "what is actually deployed on this host now?"
- The two are intentionally separate. The repo does not overwrite the host runtime truth.

## Script

Use:

```bash
node ops/deploy/scripts/release-intent.mjs --help
```

Typical flow:

```bash
# record a newly approved immutable image
node ops/deploy/scripts/release-intent.mjs set \
  --env staging \
  --sha <40-char-commit> \
  --db-compat backwards \
  --approved-by <operator>

# if a partially applied / attention_required rollout must be replaced,
# require an explicit override:
node ops/deploy/scripts/release-intent.mjs set \
  --env staging \
  --sha <40-char-commit> \
  --db-compat backwards \
  --approved-by <operator> \
  --force-supersede

# inspect the desired release later
node ops/deploy/scripts/release-intent.mjs show --env staging

# resolve the image ref for other tooling
IMAGE_REF="$(node ops/deploy/scripts/release-intent.mjs resolve --env staging)"

# mark rollout progress
node ops/deploy/scripts/release-intent.mjs mark-target --env staging --target ecs_web --status applied --image-ref "$IMAGE_REF"
node ops/deploy/scripts/release-intent.mjs mark-target --env staging --target eci_worker --status applied --image-ref "$IMAGE_REF"
```
