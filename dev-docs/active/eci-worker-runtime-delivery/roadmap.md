# Roadmap — eci-worker-runtime-delivery (T-131)

## Summary

冻结 ECI worker 的交付方式：与 ECS 共用镜像 tag，通过 `RUNTIME_ENABLED=true` 启动后台服务，以替换/重建 container group 作为发布与回滚基本动作，并明确最小环境变量矩阵、ACR pull 认证、健康探针、数据库回滚前提和依赖边界。

## Milestones

1. 任务与治理建包：`[completed]`
2. worker 角色与镜像复用契约冻结：`[pending]`
3. ECI 更新、pull 认证与回滚策略冻结：`[pending]`
4. 最小环境变量矩阵与依赖边界冻结：`[pending]`
5. 验收、扩缩容与失败回退原则冻结：`[pending]`

## Risks

- 如果 worker 与 web 拆成不同镜像，后续回滚与差异定位会明显变复杂。
- 如果继续把 ECI 当可原地修改的长期实例用，更新和失败恢复都会不稳定。
- 如果不明确 Redis/DB/LLM 依赖边界，worker 很容易上线后才暴露缺配或单活异常。
- 如果 ACR pull 认证没有在 ECI 侧固定下来，worker 可能在替换时直接卡在拉镜像阶段。
- 如果发布包含不兼容 migration，却只准备了“回切旧镜像”，worker 回退同样无法完整成立。

## Rollback

- 本任务只冻结文档，不创建真实 ECI container group。
- 后续实施时统一通过回切旧镜像 tag 并重建 container group 完成回滚。
