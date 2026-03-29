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

### 2026-03-29 - Bash compatibility
- Symptom:
  - 本地 mock rollout 首次执行时，`deploy.sh` 在 `--sha` 分支报错 `bad substitution`。
- What we tried:
  - 排查后发现脚本用了 Bash 4 的 `${var,,}` 语法，在 macOS 自带 Bash 3.2 上不兼容。
- Fix / workaround:
  - 改为 `tr '[:upper:]' '[:lower:]'` 进行 sha 规范化，避免依赖 Bash 4 专有语法。
- Prevention:
  - 后续宿主机 shell 脚本优先使用 POSIX / Bash 3.2 兼容写法，尤其不要默认使用参数大小写转换等 Bash 4 扩展。
