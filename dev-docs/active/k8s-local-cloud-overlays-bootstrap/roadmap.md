# K8s Local+Cloud Overlays Bootstrap — Roadmap

## Goal
在仓库内建立可迁移 Kubernetes 部署基线：`base + overlays(local-kind/cloud-generic)`。

## Scope
- `ops/deploy/k8s/` 新增和调整 manifests
- `ops/deploy/handbook/` 增补使用文档

## Rollout
1. 先在 kind 验证
2. 再以 cloud-generic overlay 对接具体云厂商环境
