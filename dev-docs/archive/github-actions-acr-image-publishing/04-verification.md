# 04 Verification

## Key checks

- workflow、上下文脚本、治理脚本在 immutable-only 改造后均可解析并通过基础检查。
- 本地 Docker packaging 构建与轻量 smoke 成功，说明镜像产物本身可生成且可运行。
- GitHub / Alibaba Cloud 远端前置条件全部打通：environments、branch protection、repo variables、OIDC/RAM Role、独立 self-hosted runner。
- immutable-only 版本已在默认分支上成功完成一次 `main` 自动发布和一次 `workflow_dispatch` + `prod` 审批验证。

## Final execution record

### Local packaging and workflow verification

- Workflow parsing:
  - `ruby -e 'require "yaml"; [".github/workflows/ci.yml", ".github/workflows/publish-image.yml"].each { |f| YAML.load_file(f); puts "ok #{f}" }'`
  - Result: pass
- Script syntax:
  - `node --check scripts/ci/publish-image-context.mjs scripts/ci/acr-login.mjs`
  - Result: pass
- Immutable publish context:
  - `ALICLOUD_REGION=cn-hangzhou ... GITHUB_SHA=1234567890abcdef1234567890abcdef12345678 node scripts/ci/publish-image-context.mjs --mode publish`
  - Result: 只输出 `sha_ref` 与 `created_tags=sha-1234567890abcdef1234567890abcdef12345678`
- Immutable promotion context:
  - `ALICLOUD_REGION=cn-hangzhou ... SOURCE_SHA=1234567890abcdef1234567890abcdef12345678 RELEASE_TAG=v1.2.3 node scripts/ci/publish-image-context.mjs --mode promote`
  - Result: 输出 `source_ref`、`release_ref`、`created_tags=v1.2.3`
- Local Docker build smoke:
  - `node ops/packaging/scripts/build.mjs --target llm-forum --tag llm-forum:ci-validate-local`
  - `docker image inspect llm-forum:ci-validate-local`
  - `docker run --rm --entrypoint sh llm-forum:ci-validate-local -c 'node -v && test -f /app/src/backend/server.ts && test -f /app/dist/frontend/index.html && echo image-smoke-ok'`
  - Result: pass; image digest `sha256:123c6998a08fc0f340ee7e0e24404d070d2abd09422eb6f317449631209237b5`

### Remote delivery baseline

- GitHub environments:
  - `staging` created with protected-branches policy
  - `prod` created with protected-branches policy and required reviewer
- GitHub branch protection:
  - `main` protection enabled
  - `node scripts/ci/check-branch-protection.mjs --branch main`
  - Result: pass
- Repo variables:
  - `ALICLOUD_REGION`, `ACR_NAMESPACE`, `ACR_REPOSITORY`, `ACR_LOGIN_SERVER`, `ACR_INSTANCE_ID`, `ACR_API_ENDPOINT`, `ALICLOUD_OIDC_PROVIDER_ARN`, `ALICLOUD_ROLE_ARN`
  - Result: configured on `willyu1007/Fun-ForumAI`
- Alibaba Cloud identity:
  - OIDC Provider: `acs:ram::1183869713036194:oidc-provider/github-actions`
  - RAM Role: `acs:ram::1183869713036194:role/github-actions-acr-publish`
  - Result: OIDC `AssumeRole` + ACR token path verified
- Publish runner:
  - repo runner `ecs-acr-publish-hz-01`
  - labels: `self-hosted`, `Linux`, `X64`, `aliyun-vpc`, `acr-publish`
  - service status: `active (running)`

### Immutable-only publish acceptance

- `main` auto publish:
  - Run: `23701201151`
  - URL: `https://github.com/willyu1007/Fun-ForumAI/actions/runs/23701201151`
  - Result: success
  - Image ref: `talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-2b7ae8a97f264eb8676821d426b5078c0c2b35d5`
  - Created tags: `sha-2b7ae8a97f264eb8676821d426b5078c0c2b35d5`
  - Final digest: `sha256:9dcf0c3cb7509af1cf10c16f37caef269892902b08566106f70a89cab7f47bd2`

- `workflow_dispatch` prod approval:
  - Trigger:
    - `gh workflow run 'Publish Image' --repo willyu1007/Fun-ForumAI --ref main -f source_sha=2b7ae8a97f264eb8676821d426b5078c0c2b35d5`
  - Approval:
    - `jq -n '{environment_ids:[13518290472],state:"approved",comment:"Approve immutable-only prod promotion for sha-2b7ae8a97f264eb8676821d426b5078c0c2b35d5"}' | gh api repos/willyu1007/Fun-ForumAI/actions/runs/23701278276/pending_deployments -X POST --input -`
  - Run: `23701278276`
  - URL: `https://github.com/willyu1007/Fun-ForumAI/actions/runs/23701278276`
  - Result: success
  - Source ref verified: `talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app:sha-2b7ae8a97f264eb8676821d426b5078c0c2b35d5`
  - Created tags: `none`
  - Final digest: `sha256:9dcf0c3cb7509af1cf10c16f37caef269892902b08566106f70a89cab7f47bd2`

### Governance closeout

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-129`
- Result: pass; archived task path and `archived` hub status synced to project hub
