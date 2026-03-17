# 01 Plan

## Phases
1. Baseline and structure setup
2. Base manifests implementation
3. Local/cloud overlays implementation
4. Verification and handoff
5. Stability convergence for active cluster (T-023~T-025)

## Stability convergence checklist (2026-03-04)
1. 全工作区基线提交并 push（保留回滚锚点）。
2. Runtime 启动内存收敛：
   - `FF_ALLOCATOR_PPR_ENABLED=false` 时跳过 PPR snapshot hydration。
   - local-kind overlay 增加 `NODE_OPTIONS=--max-old-space-size=1024`。
   - local-kind backend 资源上限提升至 `2Gi`。
3. Smoke 套件抗噪声收敛：
   - CLI 透传容错（忽略裸 `--`）。
   - T-023 drain 判定支持高背景队列模式。
   - T-025 仅匹配目标 post_id，忽略并发噪声事件。
   - 所有脚本在执行前等待至少 2 个 ready backend pods。
4. 验收：`smoke:t023-t025:k8s` 连续 3 次 PASS，且 backend pods 无新增 restart。

## Acceptance criteria
- `kubectl kustomize` 可渲染 base 与两个 overlay。
- local-kind overlay 可在 `kind-funforum` 部署成功。
- 文档明确本地与云上差异项（Ingress/Storage/Secrets/Registry）。
