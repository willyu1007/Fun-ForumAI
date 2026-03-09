# 02 Architecture — T-071

## Boundaries
- 本包聚焦 local-kind runtime consistency，不重做人格/观测合同设计。
- `T-070` 依旧是 rollout execution task；`T-071` 只负责清除其前置 runtime blocker。
- `T-048` 只作为历史 antecedent 记录，不 reopen。

## Inputs
- `scripts/k8s-local-staging.mjs`
- `GET /v1/admin/runtime/features`
- `POST /v1/dev/seed`
- `POST /v1/dev/runtime/post`
- `GET /v1/agents/:agentId/runs`
- local-kind overlay config 与 env SSOT

## Outputs
- local-kind 镜像 freshness 防线
- runtime/build fingerprint 读面
- persona runtime env/config 一致性
- `T-070` blocker-cleared evidence

## Dependency graph
```text
T-066 observation contract
        ↓
      T-070
        ↑
      T-071
```

## Notes
- 当前 live signal 显示：源码已实现 `persona_observation` 写面，但 local-kind 实跑仍可能落到旧镜像或缺 flag 环境。
- 因此本包优先验证“实际运行的是什么”，再处理 write/read 回归。
