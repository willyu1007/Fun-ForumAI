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

## Workflow behavior

### `CI`

- Pull requests and `main` continue to run quality gates.
- `Docker Build Validate` runs a real image build for packaging target `llm-forum`.
- ACR repository naming is decoupled from the packaging target; publish still builds target `llm-forum` and pushes it to ACR repository `app`.
- No ACR login, no image push, no deploy side effects.

### `Publish Image`

- `push` to `main`:
  - build once
  - push `sha-<commit>`, `main`, `staging`
- `workflow_dispatch`:
  - require `source_sha`
  - optionally accept `release_tag`
  - pull existing `sha-<commit>` image
  - push `prod` and optional release tag without rebuild

## Audit contract

- Image contract: `<ACR_LOGIN_SERVER>/<ACR_NAMESPACE>/app:<tag>`
- Main publish and prod promotion write:
  - `image_ref`
  - pushed tags
  - final digest
  - commit SHA
  - workflow run URL
