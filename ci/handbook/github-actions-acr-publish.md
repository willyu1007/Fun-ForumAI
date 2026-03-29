# GitHub Actions ACR Publish

## Scope

- `CI` workflow keeps quality gates and Docker build validation only.
- `Publish Image` workflow owns `GitHub Actions -> ACR` only.
- No workflow in this repo may deploy to ECS or ECI as part of T-129.

## Required GitHub repository settings

- `main` must be branch-protected before the publish workflow is allowed to use credentials on a public repository.
- Create GitHub environments:
  - `staging`
  - `prod`
- `prod` environment should require a human reviewer before promotion.

## Required repository variables

- `ALICLOUD_REGION=cn-hangzhou`
- `ACR_NAMESPACE`
- `ACR_REPOSITORY=app`
- `ACR_LOGIN_SERVER`
- `ACR_INSTANCE_ID`
- `ACR_API_ENDPOINT`
- `ALICLOUD_OIDC_PROVIDER_ARN`
- `ALICLOUD_ROLE_ARN`

Publish v1 does not require repo-level secrets.

## Required self-hosted runner labels

- `self-hosted`
- `linux`
- `x64`
- `aliyun-vpc`
- `acr-publish`

Runner baseline:

- Dedicated CI ECS only
- Docker CLI available
- Alibaba Cloud CLI available
- Stable outbound access to GitHub and ACR
- Must not co-locate business workloads from T-130 or T-131

Current v1 operation note:

- Publish runs on the dedicated self-hosted ECS runner.
- If ACR VPC binding quota is exhausted by business ECS, `ACR_LOGIN_SERVER` may temporarily use the public registry domain together with an ACR Internet whitelist for the runner IP.
- This does not change the build/promotion contract; it only changes the registry access path.

## Workflow behavior

### `CI`

- Pull requests and `main` continue to run quality gates.
- `Docker Build Validate` runs a real image build for packaging target `llm-forum`.
- ACR repository naming is decoupled from the packaging target; publish still builds target `llm-forum` and pushes it to ACR repository `app`.
- No ACR login, no image push, no deploy side effects.

### `Publish Image`

- `push` to `main`:
  - build locally on the publish runner first
  - push immutable `sha-<commit>`
  - resolve the published digest from ACR
  - record the immutable image ref and digest in the workflow summary
- `workflow_dispatch`:
  - require `source_sha`
  - optionally accept `release_tag`
  - pull existing `sha-<commit>` image
  - treat the `prod` environment approval as the promotion record
  - optionally create a one-shot immutable release tag without rebuild

Implementation notes:

- ACR login is centralized in `scripts/ci/acr-login.mjs`; do not duplicate inline `aliyun cr GetAuthorizationToken` parsing across workflow jobs.
- Runner label checks are case-insensitive because GitHub built-in labels appear as `Linux` / `X64` in the API but are commonly written as `linux` / `x64` in workflow config.
- The delivery contract is immutable-only. Do not re-introduce `main`, `staging`, `prod`, or `latest` as deployment-truth tags.
- If `release_tag` is provided, it must be a fresh immutable tag; reusing an existing release tag must fail.

## Audit contract

- Image contract: `<ACR_LOGIN_SERVER>/<ACR_NAMESPACE>/app:<tag>`
- Main publish and prod promotion write:
  - `image_ref`
  - created tags
  - final digest
  - commit SHA
  - workflow run URL
