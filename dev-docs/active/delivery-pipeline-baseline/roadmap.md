# Goal 03 — Delivery Pipeline Baseline Roadmap

## Goal
- 完成环境契约、CI/CD、打包部署与发布链路的最小闭环，确保持续交付可执行。

## Scope
- `env/contract.yaml` 与多环境 values/secrets refs 完整化。
- CI 最小可执行流水线（lint/typecheck/test）。
- Packaging/Deploy/Release 配置联调。

## Non-goals
- 复杂多云部署编排。
- 完整生产级容量与容灾策略。

## Phases
1. **Phase 1: Environment contract completion**
   - Deliverable: 关键配置键完整定义
   - Acceptance criteria: dev/staging/prod 对齐
2. **Phase 2: CI minimal gate**
   - Deliverable: PR 基线校验可跑
   - Acceptance criteria: lint/typecheck/test 全绿
3. **Phase 3: Delivery handshake**
   - Deliverable: 打包、部署、发布流程可演练
   - Acceptance criteria: dry-run 可执行

## Step-by-step plan
### Phase 0 — Discovery
- 核对当前 `ci/config.json`、`.github/workflows/ci.yml`、`ops/` 与 `release/`

### Phase 1 — Env contract
- 固化应用必需配置键
- 补齐环境差异策略与默认值
- Verification: env 合同校验通过
- Rollback: 回退合同键变更

### Phase 2 — CI baseline
- 清理占位脚本依赖，接入真实命令
- 调整 workflow 只保留必要基线 job
- Verification: 本地 + CI 双跑
- Rollback: 暂时降级为本地门禁

### Phase 3 — Delivery integration
- 对齐 packaging/deploy/release 输入输出
- 执行 dry-run 和回滚演练
- Verification: 配置驱动流程可执行
- Rollback: 回退到单步骤手工发布

## Verification and acceptance criteria
- CI: PR 触发后可稳定完成基线校验
- Env: 合同键覆盖率与环境一致性通过检查
- Deploy/Release: 至少一条 dry-run 成功

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 环境键不一致导致运行时错误 | medium | high | 先合同后实现，强校验 | 启动失败/缺键告警 | 回退到上一版合同 |
| CI 耗时过长阻碍迭代 | medium | medium | 分层 job 与并行策略 | PR 队列积压 | 临时收缩非关键 job |
| 发布链路配置漂移 | low | high | 统一配置入口与审阅清单 | dry-run 失败 | 切回手动发布流程 |
