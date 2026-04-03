# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- 不要把项目应用 stack 和共享入口层写进同一个长期维护文件里。
- 不要让 ECS web 承担 worker 角色。
- 不要在生产环境把 `latest` 当成 Compose 部署的唯一镜像引用。

## Pitfall log (append-only)

### 2026-04-02 - Broad `.dockerignore` and missing job cleanup created runner-state drift
- Symptom:
  - The repo had a root `.dockerignore`, but it still excluded directories that the Dockerfile consumes at build and runtime time, especially `ops/packaging/**`. At the same time, self-hosted publish jobs had no guaranteed cleanup, so stale images, cache, and workspace state could mask context problems on one run and amplify disk pressure on the next.
- What we tried:
  - Re-read the Dockerfile and packaging scripts against the actual Docker context rules instead of assuming the existing `.dockerignore` was safe. Separately reviewed the self-hosted workflow for `always()` cleanup and host serialization.
- Fix / workaround:
  - Corrected `.dockerignore` to explicitly re-include the Dockerfile/runtime inputs that must exist in the context:
    - `docs/project/policy.yaml`
    - `docs/stage-templates/**`
    - `ops/packaging/**`
  - Added explicit cleanup hooks to `publish-image.yml` as both a pre-clean step and an `if: always()` post-job cleanup step. The first implementation used a repo-owned Node helper, but that was later replaced by pure bash cleanup because the self-hosted runner does not have global Node before `actions/setup-node`.
  - Serialized both self-hosted publish jobs on the same concurrency group so cleanup and Docker operations cannot overlap on the publish host.
- Prevention:
  - Do not treat the existence of a `.dockerignore` file as proof that the Docker context is correct. Whenever a Dockerfile adds a `COPY` source or runs a repo script during build, verify that the root `.dockerignore` still allows that subtree. On self-hosted runners, pair every heavy Docker job with explicit pre/post cleanup and `if: always()` cleanup so failures do not leave the next run in a different state.

### 2026-04-02 - Self-hosted cleanup cannot assume global Node before `Setup Node`
- Symptom:
  - The first rerun after adding cleanup failed immediately in `Pre-clean self-hosted runner state` with `node: command not found`, and the `if: always()` cleanup step failed for the same reason.
- What we tried:
  - Initially packaged cleanup logic as a repo `node` script so the workflow could call one shared helper before and after the publish job.
- Fix / workaround:
  - Root cause is ordering: on this self-hosted runner, `node` is not globally installed before `actions/setup-node`, and the pre-clean step necessarily runs before source fetch and Node setup. Cleanup was rewritten as pure bash best-effort commands directly in `publish-image.yml`, and the now-unreachable repo helper was deleted.
- Prevention:
  - For self-hosted workflow steps that run before checkout or `actions/setup-node`, do not assume repo scripts or global Node exist. Pre-checkout/pre-setup cleanup must be implemented in shell only, or moved after the toolchain bootstrap step.

### 2026-04-02 - Self-hosted publish should not depend on `actions/setup-node` when the runner has no global Node
- Symptom:
  - After fixing cleanup, the next self-hosted rerun cleared pre-clean and source fetch but then sat in `Setup Node` for several minutes without ever reaching `Resolve publish context` or Docker build.
- What we tried:
  - Observed the live run after the cleanup fix instead of assuming the publish chain had returned to the earlier disk-I/O bottleneck. Compared the stalled step with the fact that the same job only needs Node to execute repo helper scripts.
- Fix / workaround:
  - Removed `actions/setup-node` from the self-hosted publish jobs and switched those Node-script steps (`publish-image-context.mjs`, `acr-login.mjs`, `build.mjs`, `check-image-launch-proof.mjs`) to run through `actions/github-script`, which uses the action runtime's embedded Node instead of downloading a separate Node toolcache onto the runner.
- Prevention:
  - On self-hosted runners, do not assume the repo can afford a fresh language-runtime bootstrap on every heavy delivery job. If the runner only needs Node to execute a few repo-owned helpers, prefer the action runtime's embedded Node or a preinstalled host toolchain over `actions/setup-node` downloads in the hot path.

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

### 2026-04-02 - BuildKit should not be mandatory on a runner that only has docker build
- Symptom:
  - 在 archive checkout workaround 生效后，`Publish Image` 已经可以走到 `Build immutable image locally`，但因为 workflow 仍固定 `DOCKER_BUILDKIT=1`，`docker build` 立刻报 `BuildKit is enabled but the buildx component is missing or broken.`。
- What we tried:
  - 先尝试让 self-hosted workflow 通过 `docker/setup-buildx-action@v3` 自动补齐 buildx，但这又把发布链重新绑定到新的 GitHub 资产下载；而当前 runner 本身的公网链路已经被证明并不稳定。
- Fix / workaround:
  - 把 self-hosted `publish-staging` 改成运行时探测 `docker buildx version`：
    - 有 buildx 时使用 `DOCKER_BUILDKIT=1`
    - 没有 buildx 时自动回退到 `DOCKER_BUILDKIT=0`
  - 这样构建仍可在能力更完整的 runner 上使用 BuildKit，但不会在当前 `ecs-acr-publish-hz-01` 上因为缺插件而秒失败。
- Prevention:
  - 以后 repo-side workflow 不要把“runner 预装某个 Docker 插件”当成隐含前提，除非该插件对构建语义是必需的；若只是性能增强项，应优先做 capability detection，再决定是否启用，而不是直接固定开启后让 self-hosted runner 硬失败。

### 2026-04-02 - Publish runner host I/O became the next bottleneck after workflow fixes
- Symptom:
  - 在修复 self-hosted `checkout` 和 `buildx` 问题后，`Publish Image` run `23874134550` 已经能成功走到 `Build immutable image locally`，并持续运行十多分钟，但最终仍失败；与此同时阿里云 ECS 控制台对 `ecs-acr-publish-hz-01` 报出“实例云盘读写受限”严重告警，提示云盘读写 IO 延迟过长或触达盘型 IOPS 上限。
- What we tried:
  - 先连续把 repo/workflow 侧的已知 blocker 拆掉：把 self-hosted 源码获取改为 archive/tarball、把 `buildx` 从强依赖改为 capability detection + legacy fallback，然后重新盯 publish run 的真实执行轨迹。
- Fix / workaround:
  - 目前只确认了根因层级已经上升到 runner 基础设施：Docker build 本身是高 I/O 负载，当前 `ecs-acr-publish-hz-01` 的云盘性能不足。repo 侧暂不应继续通过盲目 rerun 施压。
  - 后续修复方向应优先放在 runner 主机：
    - 升级更高性能云盘 / 提升 IOPS 档位
    - 将 `/var/lib/docker` 和必要的构建工作目录迁到独立高性能数据盘
    - 在 runner 侧降低并发和非必要 I/O 压力后，再重新验证 immutable publish
- Prevention:
  - 以后当 publish run 已经成功越过源码获取、凭证配置和构建器选择，却仍在 Docker build 中途失败时，不要继续把问题默认为 workflow 或 Dockerfile 逻辑；应同步检查 runner 所在 ECS 的云盘、IOPS、磁盘时延和 Docker data path，避免在基础设施瓶颈上反复重跑同一构建。

### 2026-04-02 - Removing top-level setup-node was not enough because the packaging helper still spawned `node`
- Symptom:
  - After the workflow stopped depending on `actions/setup-node`, the next self-hosted rerun finally reached `Build immutable image locally`, but failed with `/bin/sh: 1: node: not found` even though the top-level job was already using `actions/github-script` and the embedded action runtime Node.
- What we tried:
  - First verified the failing run instead of assuming the problem had regressed to cleanup or source-fetch. The failed log for run `23886880926` showed that the `node` failure occurred only after `ops/packaging/scripts/build.mjs` started.
- Fix / workaround:
  - Root cause was a nested process hop inside `ops/packaging/scripts/build.mjs`: it still used a shell string with `node ops/packaging/scripts/docker-build.mjs ...`. That assumption is invalid on the self-hosted publish runner because there is no global `node` binary on the host. The helper was rewritten to use `execFileSync(process.execPath, [...])` and pass build args as an array, so the same Node runtime that launched `build.mjs` also launches `docker-build.mjs`.
- Prevention:
  - When removing a runtime/bootstrap dependency from the top-level workflow, trace every nested repo helper it invokes. A self-hosted job is only truly free of global `node` assumptions when each downstream `.mjs` hop also reuses `process.execPath` or otherwise guarantees its own runtime.
### 2026-04-03 - Host smoke script drifted behind the modern `/health` contract
- Symptom:
  - During live staging rollout, `./smoke.sh` failed with `/health did not return status=ok` even though the web container was healthy and loopback `/health` returned `{"ok":true,...}`.
- What we tried:
  - Compared the live `/health` payload with `ops/deploy/vm-compose/fun-forum/smoke.sh`, then re-read the backend health routes/tests.
- Fix / workaround:
  - Root cause was contract drift: `/health` now serves the modern `HealthResponse` shape with top-level `ok`, while only `/v1/health` preserves the legacy wrapped `status` field.
  - Updated `smoke.sh` so `/health` asserts `"ok":true` and `/v1/health` continues asserting `"status":"ok"`.
- Prevention:
  - Whenever the health route contract changes, update the host smoke scripts in the same change. Do not assume `/health` and `/v1/health` share the same JSON schema.
### 2026-04-03 - Live staging env drift surfaced as host-only fixes
- Symptom:
  - Live rollout hit three host-side surprises in sequence: `deploy.sh` rejected `APP_ENV`, web startup failed with Redis `WRONGPASS`, and later web startup still needed a manual `MEDIA_S3_BUCKET` patch.
- What we tried:
  - Compared the generated Windows-side env file with the ECS host copy, checked Aliyun Tair account requirements, and traced staging startup failures back to the new fail-fast runtime checks.
- Fix / workaround:
  - Root causes were mixed:
    - uploaded `.env` carried Windows CRLF line endings, so `APP_ENV` parsed as `staging\r`
    - Tair account mode required a username-bearing Redis URI rather than password-only `redis://:password@...`
    - `MEDIA_S3_BUCKET` existed only as a host-side manual patch and had not yet been written back into repo `staging.yaml`
  - Fixed by:
    - normalizing host `.env` line endings
    - correcting Bitwarden Redis URLs to include the Tair username
    - persisting `MEDIA_S3_BUCKET` into repo `env/values/staging.yaml` and regenerating `staging.env`
- Prevention:
  - Treat live host edits as temporary only. Any non-secret env hotfix found on the host must be written back to `env/values/<env>.yaml`, and any secret or URL correction must be written back to Bitwarden before the rollout is considered closed.
