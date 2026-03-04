# 00 Overview — k8s-local-cloud-overlays-bootstrap

## Status
- State: in-progress
- Next step: 维持当前集群稳定性（持续观测 backend restart 与 T-023~T-025 套件波动），并将本地稳定参数迁移到云环境模板。

## Goal
建立一套“本地可跑、云上可迁移”的 Kubernetes 部署结构（base + overlays），支撑后续 T-023/T-024/T-025 多实例验证。

## Non-goals
- 不在本任务中完成云厂商 IaC 集群创建。
- 不在本任务中完成生产级安全加固（如 WAF/Service Mesh）。
- 不替代现有应用业务逻辑改造任务。

## Acceptance criteria (high level)
- [x] 存在可复用的 base manifests。
- [x] 存在 local-kind 与 cloud-generic overlays。
- [x] 本地 kind 可一键部署并通过基础连通性验证。
