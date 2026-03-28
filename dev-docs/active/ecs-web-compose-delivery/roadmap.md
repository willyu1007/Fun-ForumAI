# Roadmap — ecs-web-compose-delivery (T-130)

## Summary

冻结 ECS web 侧的标准化容器宿主机形态、Compose stack 组织、共享反向代理、运行时 `.env` 来源、ACR pull 认证、数据库迁移时序以及镜像发布后的拉取、重启与回滚流程，使未来多个项目都能复用同一宿主机模式，并明确 prod 多机 SSE 的 Redis 广播前提与第一阶段人工发布模型。

## Milestones

1. 任务与治理建包：`[completed]`
2. ECS 宿主机与目录规范冻结：`[pending]`
3. 共享反向代理、loopback upstream 与项目 stack 关系冻结：`[pending]`
4. staging/prod 差异、配置来源与发布门禁冻结：`[pending]`
5. 发布/回滚/健康验证顺序冻结：`[pending]`

## Risks

- 如果 ECS 采用裸 `docker run`，第二个项目接入时几乎必然出现端口、日志和重启脚本冲突。
- 如果每个项目自己带一套公网入口，未来多项目承载会持续复制反向代理与 TLS 逻辑。
- 如果不先约束 `.env`、ACR pull 认证和 Compose 目录结构，后续运维接管会高度依赖个人记忆。
- 如果 prod 多 ECS 仍使用本地 SSE 广播或入口默认短超时，实时链路会先于普通 API 故障。
- 如果数据库迁移被重复执行在每台主机上，生产风险会明显增加。
- 如果 Prisma migration 不保证向后兼容，单纯切回旧镜像无法形成完整回滚。

## Rollback

- 本任务只冻结 ECS web 文档，不会真正创建 ECS 主机或运行 Compose。
- 后续实施的回滚策略统一是“切回上一可用镜像 tag + Compose 重启”。
