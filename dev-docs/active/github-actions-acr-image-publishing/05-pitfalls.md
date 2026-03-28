# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- 不要把 ACR 发布和 ECS/ECI 部署写在同一个任务里。
- 不要把 `latest` 写成唯一部署基准。
- 不要在文档里放真实 secret、账号或实例地址。

## Pitfall log (append-only)

### 2026-03-28 - Task bootstrap
- Symptom:
  - 现有仓库已经有 CI，但没有 ACR 发布边界，容易顺手把部署也绑进 CI。
- What we tried:
  - 单独拆出 `T-129`，只负责镜像发布。
- Fix / workaround:
  - 把部署职责明确下沉到 `T-130` 与 `T-131`。
- Prevention:
  - 后续实现评审时，若 workflow 包含 ECS/ECI 重启逻辑，默认视为超出本任务边界。
