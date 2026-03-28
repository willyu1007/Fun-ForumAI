# 01 Plan

## Phases

1. Phase A: 冻结 ECS 宿主机能力基线。`[pending]`
2. Phase B: 冻结目录布局、Compose stack、共享代理与 loopback upstream 结构。`[pending]`
3. Phase C: 冻结 `staging` / `prod` 的最小差异与配置来源。`[pending]`
4. Phase D: 冻结发布、回滚和验收步骤。`[pending]`

## Detailed Steps

- 定义 ECS 主机是“标准化 Docker 宿主机”，不是“手工 Node 运行环境”。
- 定义项目目录为 `/srv/apps/fun-forum/`，项目级文件至少包含 `compose.yaml`、`.env`、`deploy.sh`、`rollback.sh`。
- 定义共享 Caddy 代理单独运行在 `/srv/infra/caddy/`，负责多项目域名到项目 stack 的本机转发。
- 冻结项目 stack 只绑定本机回环地址，默认采用 `127.0.0.1:14000 -> container:4000`，由 Caddy 反向代理到该 loopback 端口。
- 冻结每个项目都必须在宿主机运维清单中登记独占 loopback 端口；当前项目保留 `14000`。
- 定义 web 容器统一 `RUNTIME_ENABLED=false`。
- 定义 ECS 主机使用单独的 ACR 只读 pull 凭据完成 `docker login`，该凭据与 CI push 凭据分离。
- 定义运行时 `.env` 来自 repo `env/contract.yaml` 所约束的键集合，但真实值只保存在宿主机侧，不使用 GitHub secrets 直接注入运行时。
- 定义第一阶段发布控制面为人工执行：
  - 发布人进入宿主机运行 `deploy.sh`
  - 不通过 GitHub Actions 直接 SSH、滚动或重启 ECS
- 定义数据库迁移在每个目标环境中只执行一次，并发生在 ECS web 滚动更新之前。
- 定义 prod 多 ECS 前提：
  - `SSE_BROADCAST_BACKEND=redis`
  - `SSE_REDIS_URL` 已配置
  - ALB/Caddy 已验证支持 SSE 长连接和流式转发
- 定义镜像发布后的部署方式为：
  - 校验 `.env` 完整性
  - `docker login` 到 ACR
  - `docker compose pull`
  - 使用 one-shot 容器执行 `pnpm db:migrate:deploy`
  - `docker compose up -d`
  - `curl http://127.0.0.1:14000/health`
  - 执行应用 smoke
- 定义回滚方式为切回上一可用 tag 后再次 `up -d`。
- 定义数据库回滚前提：
  - 默认只回滚应用镜像，不回滚 schema
  - 若 migration 不能保证向后兼容，必须附带单独 DB 回退/修复方案
- 明确 `staging` 与 `prod` 的差异：
  - `staging`: 1 台 ECS，单 stack，人工验证后继续
  - `prod`: 2 台 ECS，ALB 在前，逐机发布，发布需人工批准
