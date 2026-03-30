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

### 2026-03-31 - Runtime image missed prisma.config.ts
- Symptom:
  - 真实 staging 首次执行 `docker compose run --rm migrate` 时，Prisma 报错 `The datasource.url property is required in your Prisma config file when using prisma migrate deploy.`，即使宿主机 `.env` 中已存在 `DATABASE_URL`。
- What we tried:
  - 先复核 ECS `.env`、Compose `env_file` 和数据库连接；确认数据库网络、账号和密码均正常后，继续检查镜像内的 Prisma 配置入口。
- Fix / workaround:
  - 根因是运行镜像只复制了 `prisma/` 目录，没有复制根目录的 `prisma.config.ts`。在补齐镜像复制后，又发现 `prisma.config.ts` 无条件依赖了 dev-only 的 `dotenv/config`，导致生产镜像 `pnpm install --prod` 阶段再次失败。最终修复为：
    - 在 `ops/packaging/services/llm-forum.Dockerfile` 的 builder/runtime 阶段都补入 `COPY prisma.config.ts ./prisma.config.ts`
    - 在 `prisma.config.ts` 中改为“可选加载 dotenv”，生产镜像只依赖注入的环境变量
    - runtime 阶段保留完整 `pnpm install --frozen-lockfile`，因为该镜像本来就承担 `prisma migrate deploy`，需要本地 `prisma` 包与 workspace 依赖一起存在；随后显式执行 `pnpm db:generate`
  - 必须重新构建并发布新的 immutable image 后，staging rollout 才能继续。
- Prevention:
  - 以后凡是把运行时配置放在仓库根目录而不是 `prisma/`、`src/` 等目录里的，都必须显式检查生产镜像是否复制到了 `/app`；不要只验证本地源码树和 Compose env 就默认容器内配置完整。
