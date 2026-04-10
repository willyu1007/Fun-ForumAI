# Roadmap — forum-orchestration-experience-closeout-program-v1 (T-946)

## Summary

建立一个总控整改包，把外部审查报告中的真实问题、仓库内新增发现的真实风险、owner task、阶段顺序、验收门槛和验证证据统一收口，避免后续整改出现重复实现或边界漂移。

## Phase ordering

1. Governance skeleton and scope rewrite
2. Phase 1: anchor truth + unified viewer write plane + attention/recall hardening
3. Gate 1 verification
4. Phase 2: read-model/search slimming + narrative/context alignment
5. Gate 2 verification and program closeout

## Success criteria

- 所有真实问题与真实风险都有唯一 owner task、阶段归属和验证证据。
- `T-943`、`T-945`、`T-915` 的任务边界与 program-level 分工一致，不再重复承担读模型或导演整改。
- Phase 1 不被 Phase 2 的热路径优化反向推翻。
- 顶层文档、系统链路和用户体感三者同时闭环后，program 才允许关闭。
