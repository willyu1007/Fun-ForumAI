# 03 Implementation Notes

## Status

- Current status: `repo-implemented`
- Last updated: 2026-04-02

## What changed

- 将 `ops/deploy/config.json` 从 cloud `k8s` 主线改为 `vm`，并补入 ECS/Compose 需要的 `appDir`、`composeFile`、`loopbackPort`、`sharedProxyDir` 等 metadata。
- 将 `ops/deploy/scripts/deploy.mjs` / `rollback.mjs` 改为“ECS host planner”，不再输出 `kubectl rollout`，而是输出宿主机上的 `deploy.sh` / `rollback.sh` 调用契约。
- 新增 canonical host files：`ops/deploy/vm-compose/fun-forum/{compose.yaml,deploy.sh,rollback.sh,smoke.sh,README.md}`。
- 在 host scripts 中实现了：
  - immutable `sha-<commit>` image guard
  - staging 强制 `--with-migrate`
  - `db_compat` / `db_plan` 记录
  - `releases/current.json` + `releases/history.jsonl`
  - current release 为 `incompatible` 时阻止 image-only rollback
- 更新 `ops/deploy/README.md`、`ops/deploy/AGENTS.md`、deployment handbook、K8s retained docs 和 `docs/project/overview/project-blueprint.json`，明确 cloud 主线已切到 ECS + Compose，而 `ops/deploy/k8s/**` 只保留给 local/dev。

## Follow-ups

- `T-129` 已于 2026-03-29 归档为 done，因此 `T-130` 的上游镜像产物前提已经满足；当前 staging 候选镜像可直接使用 repo `HEAD` `2b7ae8a97f264eb8676821d426b5078c0c2b35d5` 对应的 immutable `sha-<commit>` tag。
- 从 `T-129` 归档验证记录可直接解析出当前实际 ACR 仓库前缀：`talkshow-ai-acr-registry.cn-hangzhou.cr.aliyuncs.com/talkshow-ai/app`，因此 staging 首发无需再用占位符推导 image repository。
- 2026-03-29 在首次 staging 主机引导时发现 `env/values/{dev,staging,prod}.yaml` 仍停留在旧的 `SERVICE_NAME=your-service` / `PORT=8000` 占位值；这与 `T-130` 的 compose contract (`container:4000`) 冲突，因此已统一修正为 `SERVICE_NAME=llm-forum`、`PORT=4000`，避免生成错误的宿主机 `.env`。
- 2026-03-31 在真实 staging 首发中发现 runtime image 未包含 `prisma.config.ts`，导致容器内执行 `pnpm db:migrate:deploy` 时 Prisma 无法从配置文件解析 `datasource.url`。修复时又发现：
  - `prisma.config.ts` 原本无条件 `import 'dotenv/config'`，而生产镜像不会安装 dev-only `dotenv`
  - 运行阶段若只做 `pnpm install --prod`，本地 `prisma` 包不存在，`import 'prisma/config'` 同样会失败；而单独用 `npm install --no-save prisma` 又会被当前仓库的 `workspace:*` 依赖绊住
  已调整为：
  - builder/runtime 两个镜像阶段都复制 `prisma.config.ts`
  - `prisma.config.ts` 改为“存在 dotenv 时再加载”
  - 先临时把 runtime 阶段恢复成完整 `pnpm install --frozen-lockfile`，确保 deploy-time migrate 需要的本地 `prisma` 包和 workspace 依赖都存在，再显式执行 `pnpm db:generate`
  后续 staging 必须先消费包含该修复的新 immutable image，再重试 `deploy.sh`。
- 2026-04-01 在 `Publish Image` 真实链路中又发现：
  - `publish-image.yml` 仍强制 `DOCKER_BUILDKIT=0`，发布构建回退到 legacy builder
  - runtime 阶段的完整 `pnpm install --frozen-lockfile` 会把整套 dev graph 一起装进运行镜像，导致 `Build immutable image locally` 长时间卡在依赖安装并最终被取消/超时
  - 根因不是 runtime 不能使用 `--prod`，而是 `prisma` 包还留在 `devDependencies`，导致 production install 后 `prisma/config` 不可用
  已调整为：
  - 将 `prisma` 从 `devDependencies` 挪到 `dependencies`
  - runtime 阶段恢复为 `pnpm install --prod --frozen-lockfile`
  - `publish-image.yml` 改回 `DOCKER_BUILDKIT=1`
  - `publish-staging` job timeout 从 `45` 分钟提高到 `90` 分钟，避免构建时间波动时被过早取消
  本地完整 Docker build 已验证该组合可以成功产出运行镜像，且运行镜像内仍然可直接执行 `pnpm exec prisma --version`。
  - 2026-04-02 继续排查 self-hosted publish runner `ecs-acr-publish-hz-01` 时，先后命中了两类非源码问题：
    - runner 到 `github.com` 的 git HTTPS checkout 在默认协商下会出现 `curl 16 Error in the HTTP2 framing layer` / `GnuTLS recv error (-110)` / 443 超时，重启 runner 后仍可能复现
    - 在 workflow 恢复 `DOCKER_BUILDKIT=1` 之后，self-hosted runner 本机并没有可用的 `buildx` 组件，导致 `docker build` 直接报 `BuildKit is enabled but the buildx component is missing or broken`
  已调整为：
    - 在 `publish-staging` 和 `promote-prod` 两个 self-hosted job 中，在 checkout 前显式执行 `git config --global http.version HTTP/1.1`
    - 在 `publish-staging` 中显式加入 `docker/setup-buildx-action@v3`
  这样把 runner 上人工临时配置收回到 workflow 内，避免后续 runner 重建或重启后再次退回同样故障。
- 2026-04-02 继续对 `ecs-acr-publish-hz-01` 进行真实 run 盯跑后确认，上述修复仍然不够稳定：
  - `actions/checkout@v6` 在 self-hosted runner 上最终还是会回到 `git fetch https://github.com/...`，即使前置了 `git config --global http.version HTTP/1.1`，仍可能报 `Failed to connect to github.com port 443` / `Empty reply from server`
  - `docker/setup-buildx-action@v3` 会额外引入新的 GitHub 资产下载依赖，而当前发布脚本实际只调用普通 `docker build`，并不需要 `buildx`
  已调整为：
  - 把 `publish-staging` 和 `promote-prod` 两个 self-hosted job 的源码获取从 `actions/checkout@v6` 改为 `curl` GitHub tarball API 后在 `$GITHUB_WORKSPACE` 解压
  - 继续保留 `git config --global http.version HTTP/1.1`，但仅作为 runner transport 稳定化，而不再把成功与否绑定到 `git fetch`
  - 移除 `docker/setup-buildx-action@v3`，把 self-hosted job 里的 GitHub 外部下载依赖缩减到单一源码归档链路
  这样 self-hosted runner 只需要一次归档下载即可拿到发布所需脚本和打包定义，避免在不稳定出网条件下同时依赖 git smart HTTP 和 buildx 资产下载。
- 2026-04-02 在归档下载 workaround 生效后，self-hosted run 已经可以稳定进入 `Build immutable image locally`，但 runner 本机仍然没有 `docker buildx`，而 workflow 继续固定 `DOCKER_BUILDKIT=1` 会让 `docker build` 立即失败。为避免把发布成功与 runner 人工装插件绑定死，进一步调整为：
  - 在 `publish-staging` 中新增 `Resolve docker builder mode` 步骤
  - 如果 runner 上 `docker buildx version` 可用，则写入 `DOCKER_BUILDKIT=1`
  - 如果不可用，则自动降级写入 `DOCKER_BUILDKIT=0`
  这样 repo 默认仍优先使用 BuildKit，但在当前 `ecs-acr-publish-hz-01` 这类未预装 buildx 的 self-hosted runner 上，会自动退回 legacy builder 继续发布，不再让构建在启动瞬间失败。
- 2026-04-02 继续盯最新 self-hosted publish run `23874134550` 后，repo/workflow 侧的关键阻塞已基本清掉：
  - `Fetch source archive` 成功，说明不再被 `actions/checkout` 的 git HTTPS fetch 卡死
  - `Resolve docker builder mode` 成功，说明不再因 runner 缺少 `buildx` 而在构建启动瞬间失败
  - `Log in to ACR` 成功，说明阿里云凭证和 ACR 登录链路正常
  - `Build immutable image locally` 持续运行约 13 分钟后失败，表明问题已收敛到真实 Docker build 阶段
  同一时间，阿里云控制台对 `ecs-acr-publish-hz-01` 报出严重告警：实例云盘读写受限，提示 `2026-04-02 07:13:00` 出现读写 IO 延迟过长或打满当前云盘类型 IOPS 上限。结合本次 publish 行为，当前更可信的根因是 runner 主机的云盘性能不足以支撑镜像构建阶段的持续高 I/O，而不是 workflow 本身再次配置错误。
- 2026-04-01 增加了 repo-side desired release 层，专门解决“镜像已发布，但 ECS / ECI 不会立刻替换，之后容易忘记目标 sha”的问题：
  - 新增 `ops/deploy/scripts/release-intent.mjs`
  - 新增 `ops/deploy/release-intents/README.md`
  - 新约定为 `ops/deploy/release-intents/<env>/desired.json` + `history.jsonl`
  - `deploy.mjs` 在未显式传 `--sha/--image-ref` 时，会自动消费当前环境的 desired release
  - 该层只记录“下一次该部署谁”，不替代宿主机 `/srv/apps/fun-forum/releases/current.json`
  - 2026-04-01 晚些时候又补上两个 guardrail，避免 repo-side rollout 状态被误写：
    - `set` 如果要替换一个 `partially_applied` / `attention_required` 的 desired release，必须显式传 `--force-supersede`
    - `mark-target --status applied` 必须显式传 `--image-ref`，且该值必须和当前 desired release 的 `image_ref` 一致；脚本会把它写入 target-level `applied_image_ref`
- 需要把 canonical host files 同步到真实 ECS 主机，并在真实 ACR / staging 环境完成首次人工 rollout。
- 未来如果扩展到 2 台及以上 ECS，需要单开执行面工作，把 ALB/Caddy 长连接配置和 Redis SSE 广播一并纳入落地验证。
