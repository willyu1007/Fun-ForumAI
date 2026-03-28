# 02 Architecture

## Host shape

- ECS 采用标准化容器宿主机形态：
  - OS + Docker Engine + Compose plugin
  - 不直接跑 Node 进程
  - 不使用裸 `docker run` 作为长期模式

## Directory layout

- 项目目录固定在 `/srv/apps/fun-forum/`
- 每个项目一个独立 Compose stack，不允许多个项目共用同一个应用 compose 文件
- 每个项目必须登记唯一 loopback 端口，避免与同机其他项目冲突；当前项目保留 `14000`
- 推荐项目目录最小集合：
  - `/srv/apps/fun-forum/compose.yaml`
  - `/srv/apps/fun-forum/.env`
  - `/srv/apps/fun-forum/deploy.sh`
  - `/srv/apps/fun-forum/rollback.sh`

## Reverse proxy

- 共享反向代理默认选 `Caddy`
- `Caddy` 作为独立宿主机 stack，目录固定在 `/srv/infra/caddy/`
- 项目 stack 只暴露本机回环端口，不直接占用公网入口
- 默认 upstream 绑定为 `127.0.0.1:14000 -> container:4000`
- `Caddy` 负责按域名把请求转发到本机 loopback upstream
- 若入口前还有 `ALB`，则 `ALB + Caddy` 都必须支持 SSE 长连接和流式转发，不能沿用默认短超时

## Runtime contract

- ECS web 统一设置：
  - `RUNTIME_ENABLED=false`
  - 其职责只包括 web/API/SSE
- ECS 不承接 worker、定时后台任务或需要单活的 runtime loop
- `prod` 多 ECS 场景下，web 侧必须启用：
  - `SSE_BROADCAST_BACKEND=redis`
  - `SSE_REDIS_URL`
  否则不满足跨实例 SSE 一致性要求

## Runtime image pull and config

- ECS runtime pull 使用单独的 ACR 只读凭据，在宿主机执行 `docker login` 后写入本机 Docker config。
- 该 pull 凭据与 `T-129` 中的 CI push 身份隔离。
- 运行时配置由宿主机侧 `.env` 承载，键集合受 `env/contract.yaml` 约束。
- GitHub secrets 不作为 ECS 运行时配置源。

## Release sequence

ECS web 的发布顺序冻结为：

1. 发布人手动在目标宿主机执行发布脚本；GitHub Actions 不直接连接 ECS。
2. 宿主机校验 `.env` 与所需文件存在。
3. 使用只读 ACR 凭据执行 `docker login`。
4. `docker compose pull` 拉取目标 tag。
5. 使用 one-shot 容器执行 `pnpm db:migrate:deploy`。
6. `docker compose up -d` 更新 web stack。
7. `curl http://127.0.0.1:14000/health` 通过。
8. 执行一轮应用 smoke。

## Schema compatibility and rollback

- 默认回滚动作是“切回上一可用镜像 tag + Compose 重启”。
- 该动作的前提是本次 Prisma migration 对上一版本镜像保持向后兼容。
- 如果迁移不兼容，则必须在发布前准备单独的数据库回退或数据修复方案，不能把镜像回切描述成完整回滚。

## Environment differences

### staging

- 1 台 ECS
- 单机 Caddy + 单机项目 stack
- 可由 Caddy 直接管理外部入口
- `.env` 在主机本地维护
- 部署门禁为人工 smoke 验证

### prod

- 2 台 ECS
- 每台主机都运行共享 Caddy 与项目 stack
- ALB 在前方做入口与分发
- `.env` 按主机分发，但来源必须统一
- 发布采用逐机拉镜像、逐机重启、逐机验活
- SSE 广播后端必须切到 Redis，并验证跨实例消息可见性

## Risks

- 若未来多项目接入同一台 ECS，Caddy 配置必须继续保持“共享入口层”和“项目 stack”分离。
- 如果 ACR pull 凭据与 CI push 凭据混用，后续凭据轮换会同时影响构建与运行时。
- 如果数据库迁移不是独立的一次性步骤，而是跟随每台主机重复执行，会增加生产风险。
- 如果 prod 多 ECS 没有切到 Redis SSE 广播，SSE 会出现跨实例丢消息或只局部可见。
- 如果发布包没有说明 migration 向后兼容性，应用回滚承诺就是不成立的。
- prod 没有编排层时，逐机发布顺序和验活必须在实施阶段严格执行，否则会出现一半主机跑新版本、一半主机跑旧版本的灰度状态。
