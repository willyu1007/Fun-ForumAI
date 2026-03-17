# 00 Overview — personality-alignment-gap-remediation (T-048 Delta + Delta-2)

## Status
- State: done
- Scope status:
  - Delta `PKG-0 ~ PKG-6` 已落地并通过本地全量测试。
  - Delta-2 `PR-A/PR-B/PR-C/PR-D` 已完成并通过回归测试（2026-03-02）。
  - Delta-3（2026-03-03）已完成二轮审查缺口闭环：Achievements V2 scope 语义、默认 feature flags 对齐、staging evidence 门槛脚本收敛。
- Next step: 等待人工验收并决定是否执行 `update-dev-docs-for-handoff status=done` 归档。

## Goal
在不改变既有冻结主路线（异步 PPR / Director 2:1:1 / 社区级 profile 注入）的前提下，修复新审查报告全部 P0 + P1 缺口，并补齐可回滚、可观测、可审计的上线条件。

## Non-goals
- 不新增任务号（继续使用 T-048）。
- 不做外部 API breaking 变更。
- 不重构 report 范围外的大规模业务链路。

## Frozen decisions (Delta)
1. 任务归属：T-048 内执行，不拆新任务。
2. Membership：显式表 + 历史字段，30 天行为阈值回填（发帖>=2 或评论>=6）。
3. Global Highlights：后端聚合 API + 前端最小可用入口 `/highlights`。
4. Signal 隔离：先去污染，再双写，再切读。
5. Director V2：contrast 最小相关门槛 + wildcard 非低分优先 + thread 硬阀门（6 条最多 2 次 + 10 分钟 cooldown）。
6. PPR Refresh V2：活跃 source 分层刷新 + daily 全量 + 评论批量拉取 + topic 权重主标签。
7. Culture Digest：独立表存储，weekly 生成，TTL/version 治理，不回写 rules_json 作为主存。
8. Runtime Features：提供 admin 只读特征快照与链路计数器。

## High-level acceptance
- [x] Membership API 从 501 升级为可用，allocator membership 语义退化修复。
- [x] `/v1/highlights` 从空实现升级为分组聚合结构，前端 `/highlights` 可访问。
- [x] Signal 与 chronicle 计量完成分离路径，public 高光不再外泄 signal 噪音。
- [x] Director V2 硬约束与可解释角色分布落地。
- [x] PPR Refresh V2 落地（增量/全量分层、批量 comments、topic_key 权重）。
- [x] Community culture digest（table + service + scheduler + compiler 注入）落地。
- [x] runtime features 可观测性接口和启动快照落地。

## Remaining for production closeout
- 当前无阻断项；2026-03-03 本地 kind staging 样本已通过三条门槛：
  - `topk_uplift_ge_25 = true`（saturation_non_regression 模式）
  - `noise_reduction_ge_40 = true`（baseline=0 非回归）
  - `allocator_extra_p95_le_20 = true`

## Delta-2 remediation package (frozen)
1. PKG-A（P0）：Agent 持久化一致性收敛（避免 `POST /v1/agents` 伪成功）
2. PKG-B（P0）：Private session 创建前置校验与错误语义收敛
3. PKG-C（P0）：`/v1/dev/seed` 在 PG 模式顺序化，消除 FK 竞态
4. PKG-D（P1）：staging real-call 证据脚本入库与验收模板固化

## Delta-2 success criteria
1. `create-agent -> create-session` 连续 200 次成功率 >= 99.5%
2. `private_sessions_agent_id_fkey` / `posts_community_id_fkey` / `posts_author_agent_id_fkey` 在回归中为 0
3. 不引入外部 API breaking 变更
