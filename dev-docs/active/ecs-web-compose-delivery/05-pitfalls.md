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

### 2026-03-31 - Historical reconciliation migration still broke on clean staging replay
- Symptom:
  - staging 在换用修复后的镜像后，`docker compose run --rm migrate` 继续失败，Prisma 报 `P3018`，具体是 `20260327111000_feedback_ticket_and_schema_reconciliation` 在 fresh DB replay 时执行 `DROP TABLE "comment_search_docs"` 触发 `42P01 table does not exist`。
- What we tried:
  - 先核对 staging RDS 是否为空库、前序 migration 是否已经把 `comment_search_docs` 改名为 `thread_search_docs`，随后逐条检查 `20260324130000_t919_search_doc_comment_to_thread_cutover` 与 `20260327111000_feedback_ticket_and_schema_reconciliation` 的 SQL。
- Fix / workaround:
  - 根因是 T-919 已经把 `comment_search_docs` 重命名成 `thread_search_docs`，但后面的 schema reconciliation migration 仍假定旧表名存在。修复方式是把该 migration 的搜索投影清理段改为：先 `DROP TABLE IF EXISTS "comment_search_docs"`，再 `DROP TABLE IF EXISTS "thread_search_docs"`，最后重建最终形态的 `thread_search_docs`。
  - 修复后需要重新发布新的 immutable image，再在 staging 重新执行 `./deploy.sh --sha <new-sha> --with-migrate --db-compat backwards`。
- Prevention:
  - 以后凡是“schema reconciliation / cutover”类 migration，只要前面已有 rename/cutover 历史，就必须从空库 replay 视角再检查一次，不能只验证增量升级路径。

### 2026-04-01 - Publish build kept timing out on runtime dependency install
- Symptom:
  - `Publish Image` 的 `Build immutable image locally` 长时间停在 Docker build 内的依赖安装阶段，最终 run 被取消/超时，无法产出新的 immutable image。
- What we tried:
  - 先追 workflow 日志，确认卡点位于 runtime stage 的 `pnpm install --frozen-lockfile`，再对比本地 build 和 repo 依赖图，拆分 builder/runtime 两个阶段到底分别装了什么。
- Fix / workaround:
  - 根因是 runtime stage 为了给 `prisma migrate deploy` 保留本地 Prisma CLI，临时恢复成了完整 install；与此同时 workflow 又仍然禁用了 BuildKit，导致运行镜像把整套 devDependencies 一起装进来。最终修复为：
    - 把 `prisma` 从 `devDependencies` 挪到 `dependencies`
    - 将 runtime stage 改回 `pnpm install --prod --frozen-lockfile`
    - `publish-image.yml` 中恢复 `DOCKER_BUILDKIT=1`
    - `publish-staging` job timeout 从 `45` 分钟提高到 `90` 分钟
- Prevention:
  - 以后凡是为了运行时迁移而“临时恢复完整 install”的改动，都必须同时评估 publish pipeline 的依赖体积和 builder 模式；不要只验证功能正确就把构建成本留到 CI 上爆出来。

### 2026-04-02 - Self-hosted publish runner failed before build for transport/buildx reasons
- Symptom:
  - `Publish Image` 的 self-hosted job 在修复 runtime install 后，先是 `actions/checkout` 失败，报 `curl 16 Error in the HTTP2 framing layer` / `GnuTLS recv error (-110)` / `Failed to connect to github.com port 443`；重跑后终于越过 checkout，又在 `Build immutable image locally` 立刻报 `BuildKit is enabled but the buildx component is missing or broken.`
- What we tried:
  - 先在 `ecs-acr-publish-hz-01` 上重启 runner service，确认它能重新接单；随后直接在 runner 机上做 `getent hosts github.com`、`curl -4I --http1.1 https://github.com`、`git ls-remote https://github.com/willyu1007/Fun-ForumAI`，并查看 workflow failed logs。
- Fix / workaround:
  - 根因分两层：
    - self-hosted runner 对 GitHub 的 git HTTPS transport 在默认协商下不稳定，runner 本机手动 `git config --global http.version HTTP/1.1` 后，`curl` / `git ls-remote` 恢复正常
    - workflow 打开 `DOCKER_BUILDKIT=1` 后，self-hosted runner 本机没有可用的 `buildx`
  - 修复方式：
    - 在 `publish-image.yml` 的 self-hosted jobs 中，把 `git config --global http.version HTTP/1.1` 固化为 checkout 前置步骤
    - 在 `publish-staging` 中显式加入 `docker/setup-buildx-action@v3`
- Prevention:
  - 以后凡是修改 self-hosted publish runner 的 builder 模式或 runner 镜像，都要同时检查：
    - checkout 是否依赖不稳定的默认 git transport
    - runner 上是否已有 `buildx`
    - 不要只在 runner 主机上做人工临时修复而不回写 workflow，否则 runner 一重建就会复发。

### 2026-04-02 - HTTP/1.1 alone did not stabilize self-hosted checkout
- Symptom:
  - 即使已经在 self-hosted job 前置 `git config --global http.version HTTP/1.1`，`Publish Image` rerun 仍然可能卡在 `actions/checkout@v6`，最终报 `git fetch` 连接 `github.com:443` 超时或 `Empty reply from server`。
- What we tried:
  - 先保留标准 `actions/checkout`，只降低 git transport 风险；同时把 `docker/setup-buildx-action@v3` 放回 workflow，试图让 runner 自动补齐 BuildKit 组件。
- Fix / workaround:
  - 根因是 self-hosted runner 的不稳定点不只是 HTTP/2，而是整个 `git fetch` 路径本身；另外 `docker/setup-buildx-action` 也会引入额外的 GitHub 资产下载依赖，而当前发布脚本并不需要 `buildx`。
  - 最终修复为：
    - self-hosted `publish-staging` / `promote-prod` 直接通过 GitHub tarball API 下载指定 `sha` / `source_sha` 的源码归档并解压到 `$GITHUB_WORKSPACE`
    - 移除 `docker/setup-buildx-action@v3`
    - 将 self-hosted job 的外部依赖面收敛为单一 archive download，而不是 `git fetch + buildx asset download`
- Prevention:
  - 以后只要 self-hosted runner 的公网链路出现抖动，就不要默认“调一调 git 配置就够了”；先确认 job 是否真的需要 `.git` 元数据和额外 action asset 下载。若脚本只需要源码树，优先使用 archive/tarball 获取源码，减少发布路径上的网络协议复杂度。
