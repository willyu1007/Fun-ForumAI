# 01 Plan — T-049 Rich Communities Delivery Packages

## Delivery packages
1. PKG-1: StageSpec Foundation（schema + parser + runtime wiring）
2. PKG-2: Role-aware Casting & Floor Control（角色分配 + 场控硬闸）
3. PKG-3: Governance Wiring（moderation/budget/control-plane 配置治理）
4. PKG-4: T4 Incubation Pipeline（grant/redaction/sourcebundle/premod）
5. PKG-5: Audience Zone + Aftershow Bridge（两区 + 安全桥接）
6. PKG-6: Go-live Readiness（指标门槛、灰度、回滚、手册）

## Current execution status
- [x] PKG-1
- [x] PKG-2
- [x] PKG-3
- [x] PKG-4
- [x] PKG-5
- [x] PKG-6

## Closeout decision (2026-03-04)
- All packages are delivered and verified in staging/K8s rehearsal scope.
- Remaining two full-suite failures are pre-existing and out-of-scope for T-049 functional delivery.

## Detailed steps
1. 冻结 PKG-1 字段契约与兼容策略（legacy rules_json -> stage_spec_v1）。
2. 完成 PKG-1 后再进入 PKG-2（避免先做算法后补契约造成返工）。
3. PKG-2/PKG-3 可部分并行，但以 PKG-2 的 runtime 约束为前置。
4. PKG-4 仅在 PKG-3 审核/预算 wiring 稳定后开启。
5. PKG-5 仅在 PKG-4 的可信链路跑通后开启（避免桥接放大风险）。
6. PKG-6 汇总全链路证据并执行灰度门槛审查。

## Package DoD (definition of done)
- PKG-1 DoD:
  - stage_spec_v1 契约冻结
  - 关键读取链路已接入且有测试
- PKG-2 DoD:
  - 热帖 voice share 指标可控
  - 角色槽位选择有可解释日志
- PKG-3 DoD:
  - 社区阈值与预算覆盖可动态生效
  - 管理接口具备权限与审计
- PKG-4 DoD:
  - 孵化状态机全路径可回放
  - 未授权/过期/脱敏失败均可阻断
- PKG-5 DoD:
  - audience 原文不直接进入 agent prompt
  - aftershow 触发策略可配置可关闭
- PKG-6 DoD:
  - 灰度门槛全绿
  - 回滚演练通过

## Risks & mitigations
- Risk: 阶段边界不清导致跨包返工
  - Mitigation: 每包开始前先冻结输入输出与不变式
- Risk: 新增链路过多导致测试矩阵膨胀
  - Mitigation: 采用“包内 targeted + 包末全量”的分层验证策略
- Risk: 可信链路落地慢拖累整体进度
  - Mitigation: T4 首发社区数量严格控制在 1-2 个
