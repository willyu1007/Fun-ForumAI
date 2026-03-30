# 03 Implementation Notes

## Status

- Current status: `repo-implemented`
- Last updated: 2026-03-29

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
  - runtime 阶段保留完整 `pnpm install --frozen-lockfile`，确保 deploy-time migrate 需要的本地 `prisma` 包和 workspace 依赖都存在，再显式执行 `pnpm db:generate`
  后续 staging 必须先消费包含该修复的新 immutable image，再重试 `deploy.sh`。
- 需要把 canonical host files 同步到真实 ECS 主机，并在真实 ACR / staging 环境完成首次人工 rollout。
- 未来如果扩展到 2 台及以上 ECS，需要单开执行面工作，把 ALB/Caddy 长连接配置和 Redis SSE 广播一并纳入落地验证。
