# 03 Implementation Notes

## Status

- Current status: `bundle-created`
- Last updated: 2026-03-28

## What changed

- 建立 `T-129` bundle，专门承载 GitHub Actions -> ACR 产物链路。
- 冻结本任务只定义镜像发布，不定义任何部署副作用。
- 预先冻结镜像仓库、tag、OIDC 凭据与 GitHub 配置清单的文档边界。
- 复检缺口后，补入了 build-once-promote-many、publish job runner 网络形态，以及 CI push 凭据与运行时 pull 凭据分离的要求。

## Follow-ups

- 后续实施阶段需要把现有 `.github/workflows/ci.yml` 与新增发布 job 的职责重新梳理。
- 若实际 ACR 账号不是 Enterprise Edition，需要在实施阶段单独记录差异，但不改动本任务主叙事。
