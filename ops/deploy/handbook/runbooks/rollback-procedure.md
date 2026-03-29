# Rollback Procedure

## Quick steps

1. Identify the failing immutable image ref and confirm impact.
2. Inspect the host release history in `/srv/apps/fun-forum/releases/`.
3. Execute `rollback.sh` on the ECS host.
4. Verify loopback health and `smoke.sh`.

## Detailed procedure

### 1. Assess impact

- Check monitoring dashboards
- Review application and proxy logs
- Determine whether the issue is app-only or also involves database compatibility
- Notify stakeholders if needed

### 2. Execute rollback

Rollback to the previous recorded immutable image:

```bash
cd /srv/apps/fun-forum
./rollback.sh
```

Rollback to a specific immutable image:

```bash
cd /srv/apps/fun-forum
./rollback.sh --to-image-ref <acr-login-server>/<namespace>/app:sha-<commit>
```

If the current release recorded `db_compat=incompatible`, complete the separate DB recovery and then provide the recovery reference:

```bash
cd /srv/apps/fun-forum
./rollback.sh --db-plan <ticket-or-note>
```

### 3. Verify

- `curl http://127.0.0.1:14000/health`
- `./smoke.sh`
- Confirm the release record was updated in:
  - `releases/current.json`
  - `releases/history.jsonl`

### 4. Post-incident

- Document what happened
- Identify root cause
- Decide whether the failed release should stay blocked for all environments
- Update the runbook if the rollback contract changed

## Notes

- Mutable aliases (`main`, `staging`, `prod`, `latest`) are not rollback targets.
- Image-only rollback is not equivalent to DB rollback.
- Keep K8s rollback procedures in the retained `ops/deploy/k8s/` documentation only as local/test references.
