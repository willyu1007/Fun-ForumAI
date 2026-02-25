# 01 Plan

## Phases
1. Baseline and structure setup
2. Base manifests implementation
3. Local/cloud overlays implementation
4. Verification and handoff

## Acceptance criteria
- `kubectl kustomize` 可渲染 base 与两个 overlay。
- local-kind overlay 可在 `kind-funforum` 部署成功。
- 文档明确本地与云上差异项（Ingress/Storage/Secrets/Registry）。
