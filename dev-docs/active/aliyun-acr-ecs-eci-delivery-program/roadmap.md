# Roadmap — aliyun-acr-ecs-eci-delivery-program (T-128)

## Summary

为当前项目建立阿里云专用交付链任务包，冻结 `GitHub Actions -> ACR -> ECS(web) + ECI(worker)` 的目标形态、依赖顺序、验收标准与回滚策略。本轮不仅覆盖镜像发布与运行时部署，还要补齐数据库迁移时序、配置/密钥来源、运行时拉镜像认证、SSE 多实例约束、第一阶段人工部署控制面与环境晋升门禁。

## Milestones

1. 任务与治理建包：`[in-progress]`
2. GitHub Actions -> ACR 发布方案冻结：`[pending]`
3. ECS web Compose 交付方案冻结：`[pending]`
4. ECI worker 交付方案冻结：`[pending]`
5. 全链路发布顺序、配置来源、验收与回滚冻结：`[pending]`

## Risks

- 如果不先冻结“单次构建、多环境晋升”，后续 staging/prod 会自然分叉成两套镜像。
- 如果数据库迁移没有独立时序，web 与 worker 可能在 schema 不一致时上线。
- 如果把“回滚旧镜像”误当成“回滚数据库”，一旦迁移不兼容，回滚会停在半途。
- 如果 CI push 凭据、ECS pull 凭据和 ECI pull 凭据没有分离，后续轮换会混乱。
- 如果 prod 多 ECS 仍沿用本地 SSE 广播或入口层未支持长连接，实时链路会先于普通 API 出现故障。
- 如果不先定 ECS 多项目宿主机模式，第二个项目接入时会立即遇到端口、域名和脚本冲突。

## Rollback

- 本任务只写文档与治理；回滚仅涉及移除 task bundle 与 project hub 注册信息。
- 后续真实实施统一通过“回切上一可用镜像 tag”完成，不依赖重新构建旧镜像。
