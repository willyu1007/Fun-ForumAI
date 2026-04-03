# 04 Verification

## Final verification summary

- Scope closed: `T-130 ecs-web-compose-delivery`
- Verification status: pass
- Coverage:
  - GitHub-hosted immutable image publish
  - env contract and staging values
  - health route contract
  - live staging ECS web rollout
  - host smoke validation

## High-signal checks

- 2026-04-02 GitHub-hosted publish migration:
  - `node --input-type=module -e "import fs from 'node:fs'; import YAML from 'yaml'; YAML.parse(fs.readFileSync('.github/workflows/publish-image.yml', 'utf8')); console.log('yaml_ok')"`
    - Result: `yaml_ok`
  - `gh run view 23890235648 --json jobs,status,conclusion,headSha,url`
    - Result: publish workflow succeeded on GitHub-hosted runners and produced immutable image `talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-19650c0e3f53d63f84d4a4d0cd0e147b229b5466`.
  - `gh run view 23890543620 --json jobs,status,conclusion,headSha,url`
    - Result: latest mainline image for commit `15cf153b9132f60ea8cbc2d273c484f789cfe797` was already published successfully; a later rerun failed only because the immutable tag already existed, confirming publish-once semantics instead of a build failure.

- 2026-04-03 repo-side deployment fixes:
  - `python -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root .`
    - Result: pass, including `staging` values with `MEDIA_S3_BUCKET`.
  - `pnpm vitest run src/backend/routes/__tests__/health.test.ts`
    - Result: pass (`3/3`), confirming `/health` modern contract and `/v1/health` legacy wrapper contract.
  - `git diff --check`
    - Result: pass.

- 2026-04-03 live staging ECS rollout:
  - `sudo -E docker compose logs --tail=120 web`
    - Result: startup succeeded; logs showed `Connected to Redis runtime backend`, `Connected to Redis broadcast backend`, and `Server running on http://localhost:4000`.
  - `curl -i http://127.0.0.1:14000/health`
    - Result: `HTTP/1.1 200 OK` with body `{"ok":true,"checks":{"app":"ok","db":"ok","redis":"ok"},...}`.
  - `sudo -E ./smoke.sh`
    - Result: passed on the ECS host after syncing the host script to the modern `/health` contract.

## Residual notes

- Worker rollout and ALB cutover remain outside `T-130` scope.
- Canonical operator sequence is now documented in `ops/deploy/handbook/runbooks/deployment-mainline.md`.
