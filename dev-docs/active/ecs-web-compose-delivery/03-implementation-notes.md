# 03 Implementation Notes

## Status

- Current status: `bundle-created`
- Last updated: 2026-03-28

## What changed

- 建立 `T-130` bundle，单独承载 ECS web 的宿主机与 Compose 交付方案。
- 冻结 ECS 的长期形态为“标准化 Docker 宿主机”，避免后续退化为散养 `docker run`。
- 冻结共享反向代理默认采用 `Caddy`，并与项目 stack 分离。
- 预先冻结 `staging=1 ECS`、`prod=2 ECS + ALB` 的最小差异。
- 对照需求复检后，补入了 loopback upstream 约定、宿主机侧 ACR pull 认证、运行时 `.env` 来源、第一阶段人工发布模型、prod 多 ECS 的 SSE Redis 广播前提，以及 `db:migrate:deploy -> web health/smoke` 的发布时序。
- 同步明确 Prisma migration 下的回滚前提，避免将“切旧镜像”误写成“完整回滚”。

## Follow-ups

- 后续实施阶段需要把 ECS 主机初始化、Caddy 模板、Compose 文件模板与发布脚本统一起来。
- 若后续多项目规模增长到 Compose 难以管理，应新开任务评估更高阶编排，而不是在本任务中扩容范围。
