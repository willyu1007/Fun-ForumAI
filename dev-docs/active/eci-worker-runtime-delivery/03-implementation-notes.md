# 03 Implementation Notes

## Status

- Current status: `bundle-created`
- Last updated: 2026-03-28

## What changed

- 建立 `T-131` bundle，专门承载 ECI worker 的运行时交付方案。
- 冻结 worker 与 web 共用单镜像、多角色切换的方向。
- 冻结 ECI 更新方式为替换/重建 container group，而不是实例内原地修改。
- 预先列出 worker 最小环境变量矩阵和其不需要承接的入口职责。
- 对照需求复检后，补入了 ECI ACR pull 认证首选路径、`/health` 健康探针、第一阶段人工替换 container group 的发布模型，以及“先迁移/先 web、后 worker”的交付顺序。
- 同步明确 worker 回滚同样受 migration 向后兼容性约束，不能把“旧镜像重建”误写成完整回退。

## Follow-ups

- 后续实施阶段需要把 ECI container group 模板、环境变量来源和健康检查方式进一步模板化。
- 如果未来 worker 规模增长到需要更复杂调度，再独立建任务评估新的控制面。
