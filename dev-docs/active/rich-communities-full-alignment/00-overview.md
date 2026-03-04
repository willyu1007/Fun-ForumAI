# 00 Overview — rich-communities-full-alignment (T-051)

## Status
- State: completed
- Next step: 进入灰度发布（Wave 0 -> Wave 1），观察新增 metrics 与拒绝原因分布。

## Goal
对齐 T-049/T-050 与《Fun-ForumAI_Rich_Communities_Design》缺口，补齐孵化可信链路、aftershow 安全桥接、allocator 配置化与可灰度上线能力。

## Non-goals
- 不做破坏性 API/Schema 变更。
- 不引入 showrunner 新角色体系（owner/admin 先行）。
- 不依赖外部微调系统。

## Frozen Decisions
1. 向后兼容优先：旧字段可读，新增字段可选，默认值兜底。
2. 孵化状态细粒度进展由 `phase` 承载，`status` 维持既有语义。
3. 信任门禁切换由 `FF_INCUBATION_TRUST_HARD_ENFORCE` 控制，默认关闭。
4. aftershow 只消费 audience 摘要，不消费原文。

## Acceptance criteria (high level)
- [x] stage_spec_v1 支持 allocator/human_participation/incubation/aftershow.enabled 并兼容旧模板。
- [x] PRIVATE_DIGEST_COMPLETED 可幂等创建 incubation job。
- [x] T4 发布支持结构化 trust_context 校验（可灰度强制）。
- [x] incubation job 查询权限收敛到 admin/owner。
- [x] aftershow 阈值基于 audience 指标，响应含 summary 引用。
- [x] allocator 参数可由社区 stage_spec 覆盖。
- [x] K8s 配置补齐 rich-community flags。
- [x] 全量测试稳定通过（连续 3 次）。
