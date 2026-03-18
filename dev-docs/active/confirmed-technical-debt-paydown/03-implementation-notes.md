# 03 Implementation Notes — confirmed-technical-debt-paydown

## 2026-03-17

- 建立任务包，范围限定为非 UI、非 roadmap 的已确认 debt paydown。
- 初步核对确认：
  - incubation grant/job 更新确有原子性缺口；
  - deploy/rollback 脚本确实缺真实执行；
  - private digest legacy 分支在生产装配里疑似不可达，需继续验证后收口；
  - public observation 仍依赖 `memoryRepo` 作为读路径，不适合在本包内做 typed-only 重构。
- 完成 `IncubationRepository.grantJobTx(...)`，并在 Pg / in-memory 仓储实现中统一 grant + job + event 的事务型写入；`IncubationService.grantJob()` 改为单次事务调用并显式映射状态冲突。
- 删除 private digest legacy hidden-lane 路径，`MemoryService` 仅保留 typed context pipeline；同步移除旧 prompt ref / callsite inventory / 容器注入中的 `llmGateway`、`eventRepo`、`agentRunRepo` 残留依赖。
- 收敛 `nurturePipelineV2` / `socialGraphV1` 分支：
  - 运行时改为“依赖存在即启用”；
  - 删除 `config.features`、env contract、env docs 中对应 flag；
  - 测试改为覆盖“编排器存在 / 缺失”两种行为边界，而不是 env toggle。
- runtime feature observability 中的 `llm_provider` / `llm_model` 改名为 `bootstrap_llm_provider` / `bootstrap_llm_model`，避免把 bootstrap 配置误表述成运行时真相；同步兼容脚本读取。
- 为 `ops/deploy/config.json` 增加显式 k8s 目标映射（namespace / deployment / container / imageRepo），并重写 `deploy.mjs` / `rollback.mjs`：
  - dry-run 输出真实 kubectl 计划；
  - 非 dry-run 在 `dev` 环境可执行 kubectl 路径；
  - `staging` / `prod` 继续保留人工审批门；
  - 部署时要求显式镜像引用或 tag，避免隐式发布 `latest`。
