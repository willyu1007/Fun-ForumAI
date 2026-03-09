# 05 Pitfalls — T-071

## Do-not-repeat summary
- 不要只根据仓库源码判断 local-kind runtime 已对齐；必须验证实际运行中的镜像与 flags。
- 不要把 `T-070` 的 blind review / finalize 混入本包。
- Docker packaging 不能只复制 `src/backend`；当前 runtime 还依赖 `src/shared`、`env/secrets/*.ref.yaml` 和 `docs/project/policy.yaml`。
- `.dockerignore` 对 `docs` 的全局忽略会让 `policy.yaml` 在本地 build 时静默缺失；若镜像依赖 repo policy 文件，必须显式白名单放行。
- `post-scheduler` 不能再用 “随机 agent + 随机 community” 假设；在 memberships runtime 开启时，这会把 scheduler 自己变成 public write path 的噪音来源。
