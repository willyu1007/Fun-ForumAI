# 00 Overview — ecs-web-compose-delivery (T-130)

## Status

- State: done
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`, `T-129 github-actions-acr-image-publishing (done)`
- Current status: closed. The cloud deployment mainline now uses GitHub-hosted immutable image publish plus ECS host deployment through `Docker Compose`, and staging web rollout has been verified on a real ECS host.
- Outcome snapshot:
  - immutable `sha-<commit>` images publish successfully to ACR from GitHub-hosted runners
  - canonical ECS host assets remain under `ops/deploy/vm-compose/fun-forum/`
  - staging env rendering and reinjection are aligned with repo values and Bitwarden secrets
  - host smoke validation now matches the modern `/health` contract
  - the end-to-end operator playbook is consolidated in `ops/deploy/handbook/runbooks/deployment-mainline.md`
- Next step: maintenance only. Future deployment work should consume the published runbooks and desired-release flow instead of reopening this task.

## Goal

Standardize ECS web delivery around a reusable host-operated `Docker Compose` model so staging and prod deployments consume immutable ACR images with explicit rollback and env injection rules.

## Non-goals

- Do not introduce ACK, k3s, or a multi-node orchestration control plane in this task.
- Do not move the worker role onto the ECS web host.
- Do not require GitHub Actions to SSH into ECS hosts.
- Do not make ALB/Caddy cutover part of the task completion gate.

## Acceptance Criteria

- [x] ECS delivery is standardized on `Docker Engine + Docker Compose`.
- [x] Host directory layout is fixed at `/srv/apps/<project>/`.
- [x] Shared reverse proxy responsibility remains separated from the project stack.
- [x] `staging` / `prod` host shape, env source, and rollout gates are explicit.
- [x] Operators use `deploy.sh` / `rollback.sh`; GitHub Actions does not deploy directly to ECS.
- [x] Redis-backed SSE is required for multi-host production expansion.
- [x] ACR pull auth, DB migration ownership, health checks, and smoke order are explicit.
- [x] Rollback is only promised when DB migrations are backward-compatible or an explicit DB recovery plan exists.
- [x] Deploy and rollback both revolve around immutable image refs plus Compose restarts.
