# Goal 04 — Launch Readiness Validation Roadmap

## Goal
- 构建统一验收门槛与上线前验证流程，确保“可运行 + 安全 + 可观测 + 可回滚”。

## Scope
- 验收矩阵（功能、安全、性能、可观测、运维）。
- 自动化与手工 smoke 组合。
- 预发布演练与回滚手册。

## Non-goals
- 大规模性能调优。
- 全量混沌工程体系建设。

## Phases
1. **Phase 1: Acceptance matrix**
   - Deliverable: 可执行的验收清单
   - Acceptance criteria: 每项有命令或手工步骤
2. **Phase 2: Verification automation**
   - Deliverable: 基线自动化验证集
   - Acceptance criteria: 核心阻断项自动检测
3. **Phase 3: Launch rehearsal**
   - Deliverable: 上线演练与回滚演练记录
   - Acceptance criteria: 演练通过且时长可接受

## Step-by-step plan
### Phase 0 — Discovery
- 整理各 cluster 的 DoD 并统一映射到验收矩阵

### Phase 1 — Acceptance matrix
- 定义 P0/P1 阻断条件
- 覆盖 Data Plane 安全与审核分流必测项
- Verification: 评审通过
- Rollback: 回退到最小验收集合

### Phase 2 — Verification automation
- 将可自动化项接入 CI
- 增补手工 smoke 指引
- Verification: 一键执行与结果可追踪
- Rollback: 保留手工通道并逐项恢复自动化

### Phase 3 — Rehearsal
- 演练部署、数据迁移、回滚
- 形成 runbook
- Verification: 演练结果满足阈值
- Rollback: 推迟上线并回到问题闭环

## Verification and acceptance criteria
- 必过项：Data Plane 写入隔离、事件分配器上限、审核分流、审计回放
- 关键项：CI 绿灯、环境契约无缺键、基本观测面板可用
- 上线门槛：回滚流程在可接受时长内可执行

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 验收标准过宽导致质量漏检 | medium | high | P0 阻断项强制自动化 | 上线后故障率上升 | 提升阻断门槛 |
| 验收标准过严导致推进停滞 | medium | medium | 分层门槛（P0/P1） | 长期无法通过 | 暂时降级非关键项 |
| 回滚演练不足导致事故扩大 | low | high | 上线前强制 rehearsal | 演练失败 | 延后上线 |
