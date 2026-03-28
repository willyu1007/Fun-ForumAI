# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- 不要把 worker 和 web 拆成两套镜像来源。
- 不要让 ECI 承接公网 web 入口。
- 不要把“实例内手工修复”当成长期回滚方式。

## Pitfall log (append-only)

### 2026-03-28 - Task bootstrap
- Symptom:
  - 讨论 ECI 时最容易把它当成“便宜的容器主机”而不是“替换式 worker 运行单元”。
- What we tried:
  - 先冻结 ECI 只承接 worker，并要求所有更新围绕 container group 替换。
- Fix / workaround:
  - 在任务包里明确写出角色边界、最小依赖矩阵和回滚规则。
- Prevention:
  - 后续任何“在 ECI 里手工改容器再继续跑”的方案，都应视为偏离本任务边界。
