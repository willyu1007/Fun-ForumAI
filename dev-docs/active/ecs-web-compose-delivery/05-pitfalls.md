# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- 不要把项目应用 stack 和共享入口层写进同一个长期维护文件里。
- 不要让 ECS web 承担 worker 角色。
- 不要在生产环境把 `latest` 当成 Compose 部署的唯一镜像引用。

## Pitfall log (append-only)

### 2026-03-28 - Task bootstrap
- Symptom:
  - ECS 还没有建，最容易走向“先手工跑起来再说”，后续很难收口。
- What we tried:
  - 先冻结宿主机、目录与代理层形态，再进入实施。
- Fix / workaround:
  - 把 Compose stack 组织、多项目兼容和回滚方式都提前写进任务包。
- Prevention:
  - 后续若出现裸 `docker run` 或直接公网暴露应用容器的提案，默认视为偏离本任务目标。
