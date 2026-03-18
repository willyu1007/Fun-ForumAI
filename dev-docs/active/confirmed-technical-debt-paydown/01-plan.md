# 01 Plan — confirmed-technical-debt-paydown

1. 建立 task bundle 并同步 project governance。
2. 为 incubation grant/update 增加仓储级事务接口，并补测试覆盖成功/失败路径。
3. 为 deploy / rollback 脚本实现真实 kubectl 执行逻辑，保留 dry-run、审批和前置校验语义。
4. 审计 memory / hidden lane 过渡代码，删除生产上不可达或无必要的 fallback/分支。
5. 运行质量检查、清理临时产物和 `TECHNICAL-DEBT.md`，提交并推送。
