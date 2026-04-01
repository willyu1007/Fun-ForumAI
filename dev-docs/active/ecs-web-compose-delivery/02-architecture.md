# 02 Architecture

## Deployment mainline

- Cloud `staging/prod` 统一采用 `ECS + Docker Compose`。
- `ops/deploy/config.json` 的 cloud 模型已切到 `vm`，本任务对应的 canonical host assets 位于 `ops/deploy/vm-compose/fun-forum/`。
- `ops/deploy/k8s/**` 与相关文档被保留为 local/dev 验证路径，不再代表云端主交付面。

## Host shape

- ECS 采用标准化容器宿主机形态：
  - OS + Docker Engine + Compose plugin
  - 不直接跑 Node 进程
  - 不使用裸 `docker run` 作为长期模式
- 当前项目固定宿主机目录：
  - `/srv/apps/fun-forum/`
  - `/srv/infra/caddy/`

## Canonical host files

- 项目目录最小集合固定为：
  - `/srv/apps/fun-forum/compose.yaml`
  - `/srv/apps/fun-forum/.env`
  - `/srv/apps/fun-forum/deploy.sh`
  - `/srv/apps/fun-forum/rollback.sh`
  - `/srv/apps/fun-forum/smoke.sh`
- 发布状态固定为：
  - `/srv/apps/fun-forum/releases/current.json`
  - `/srv/apps/fun-forum/releases/history.jsonl`
- 发布记录 schema 固定为：
  - `image_ref`
  - `deployed_at`
  - `deployed_by`
  - `db_compat`
  - `db_plan`
  - `notes`

## Repo-side desired release intent

- 为避免“镜像已发布，但 ECS / ECI 延后替换时忘记该用哪个 immutable image ref”，repo 侧增加独立的 desired release 记录层：
  - `ops/deploy/release-intents/<env>/desired.json`
  - `ops/deploy/release-intents/<env>/history.jsonl`
- 该层回答的是：
  - `desired.json`：这个环境下一次应该部署哪个 immutable image ref
  - `history.jsonl`：这个 desired release 如何被批准、刷新、替换、完成
- 它不替代宿主机 `/srv/apps/fun-forum/releases/current.json`：
  - repo-side desired release = 下一次该部署谁
  - host-side current release = 这台 ECS 现在实际跑谁
- desired release record 最小 schema 固定为：
  - `image_ref`
  - `git_sha`
  - `published_at`
  - `approved_at`
  - `approved_by`
  - `db_compat`
  - `db_plan`
  - `notes`
  - `targets.ecs_web.status`
  - `targets.eci_worker.status`
  - `status`
- `set` 若要替换一个已处于 `partially_applied` / `attention_required` 的 desired release，必须显式传 `--force-supersede`；否则拒绝覆盖当前 in-flight rollout。
- `mark-target --status applied` 必须同时提供 `--image-ref`，并且该值必须与当前 desired release 的 `image_ref` 完全一致，避免 repo-side 记录把错误镜像误标为已部署。

## Reverse proxy and loopback contract

- 共享反向代理默认选 `Caddy`
- `Caddy` 作为独立宿主机 stack，目录固定在 `/srv/infra/caddy/`
- 项目 stack 只暴露本机回环端口，不直接占用公网入口
- 默认 upstream 绑定为 `127.0.0.1:14000 -> container:4000`
- `Caddy` 负责按域名把请求转发到本机 loopback upstream
- 若入口前还有 `ALB`，则 `ALB + Caddy` 都必须支持 SSE 长连接和流式转发，不能沿用默认短超时

## Compose contract

- Compose stack 只包含两个 service：
  - `web`
  - `migrate`
- 两个 service 复用同一个 ACR image ref
- `web` 固定：
  - `RUNTIME_ENABLED=false`
  - `restart: unless-stopped`
  - loopback 端口 `127.0.0.1:14000:4000`
  - 容器健康检查命中 `http://127.0.0.1:4000/health`
- `migrate` 固定：
  - 同镜像
  - `RUNTIME_ENABLED=false`
  - `command: pnpm db:migrate:deploy`
  - one-shot 运行，不长期驻留

## Runtime image pull and config

- ECS runtime pull 使用单独的 ACR 只读凭据，在宿主机执行 `docker login` 后写入本机 Docker config。
- 该 pull 凭据与 `T-129` 中的 CI push 身份隔离。
- 运行时应用配置由宿主机侧 `.env` 承载，键集合受 `env/contract.yaml` 约束。
- ACR pull 元数据不放入应用 `.env`，而是由 operator shell 注入：
  - `ACR_PULL_USERNAME`
  - `ACR_PULL_PASSWORD`
  - `ACR_IMAGE_REPOSITORY`（仅 `--sha` 模式需要）

## Immutable image input contract

- `deploy.sh` 只接受以下两种镜像输入：
  - `--image-ref <acr/...:sha-<commit>>`
  - `--sha <40-char-commit>`
- `main`、`staging`、`prod`、`latest` 这些 mutable alias 一律拒绝。
- 之所以冻结为 immutable-only，是因为 `T-129` 当前仍被 ACR `TagImmutability=true` 阻塞，mutable alias 不能作为可靠的运行时真值。
- repo-side desired release 也只记录 immutable image ref；如果需要人类可读的辅助 tag，只能作为旁路 metadata，不能替代 canonical `sha-<commit>`。

## Release sequence

ECS web 的发布顺序冻结为：

1. `Publish Image` 产出 immutable `sha-<commit>` 镜像。
2. 人工将目标环境的 desired release 写入 `ops/deploy/release-intents/<env>/desired.json`。
3. 发布人手动在目标宿主机执行发布脚本；GitHub Actions 不直接连接 ECS。
4. 宿主机校验 `.env` 与所需文件存在。
5. 使用只读 ACR 凭据执行 `docker login`。
6. `docker compose pull web migrate`
7. 按需执行 `docker compose run --rm migrate`
8. `docker compose up -d --no-deps web`
9. `curl http://127.0.0.1:14000/health` 通过。
10. 执行 `./smoke.sh`
11. 将发布结果写入 `releases/current.json` 与 `releases/history.jsonl`
12. 在 repo-side desired release 中把 `ecs_web` 标为 `applied`；后续 worker 消费同一个 `image_ref`

## Rollback contract

- 默认回滚动作是“切回上一可用镜像 tag + Compose 重启”。
- `rollback.sh` 默认从 `releases/history.jsonl` 解析上一条 image ref，也可显式传入 `--to-image-ref`.
- 如果当前 release 记录为 `db_compat=incompatible`，则 image-only rollback 被阻止，必须在完成独立 DB 恢复后提供 `--db-plan <ticket-or-note>`。
- 发布与回滚都不自动二次触发“自动回滚”；脚本失败即退出，由发布人决定是否执行 rollback。

## Environment differences

### staging

- 1 台 ECS
- 单机 Caddy + 单机项目 stack
- 可由 Caddy 直接管理外部入口
- `.env` 在主机本地维护
- `--with-migrate` 为强制要求
- 部署门禁为人工 smoke 验证

### prod

- 当前 1 台 ECS + 1 个 ECI worker
- 单机共享 Caddy + 单机项目 stack
- `.env` 在主机本地维护，worker 侧配置在 ECI
- 发布采用人工批准 + 单机执行
- 未来扩到多 ECS 前，必须先满足 Redis SSE 广播与 ALB/Caddy 长连接门槛

## Risks

- 如果未来多项目接入同一台 ECS，Caddy 配置必须继续保持“共享入口层”和“项目 stack”分离。
- 如果 ACR pull 凭据与 CI push 凭据混用，后续凭据轮换会同时影响构建与运行时。
- 如果数据库迁移不是独立的一次性步骤，而是跟随每台主机重复执行，会增加生产风险。
- 如果 prod 多 ECS 没有切到 Redis SSE 广播，SSE 会出现跨实例丢消息或只局部可见。
- 如果发布包没有说明 migration 向后兼容性，应用回滚承诺就是不成立的。
