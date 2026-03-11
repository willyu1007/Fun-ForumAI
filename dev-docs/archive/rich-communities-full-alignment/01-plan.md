# 01 Plan — T-051

## Phase 0 Governance
1. 创建任务包并登记 project hub。
2. 冻结兼容策略与验收矩阵。

## Phase 1 StageSpec Contract
1. 扩展 stage_spec_v1 schema：allocator/human_participation/incubation/aftershow.enabled。
2. 增加别名映射：`aftershow.threshold.min_comments` -> `audience_comments`。
3. 更新控制面 PATCH schema 与模板脚本兼容。

## Phase 2 Incubation Orchestrator
1. 新增 orchestrator，接入 memory digest hook。
2. 幂等创建 seed job（session+community）。
3. 记录 phase 与事件链路。

## Phase 3 Trust Gate Hardening
1. data-plane post 入参新增 trust_context。
2. 用 grant/source bundle/redaction 结构化校验替换正文正则。
3. 通过 FF_INCUBATION_TRUST_HARD_ENFORCE 灰度切换强制策略。

## Phase 4 Audience->Aftershow Bridge
1. 新增 audience summary 存储与服务。
2. aftershow 改为 audience 阈值判定。
3. manual 触发权限收敛到 admin/owner。

## Phase 5 Allocator Configurability
1. stage_spec allocator 覆盖 quota/floor/cooldown。
2. 候选选择与导演策略读取社区配置。

## Phase 6 Deploy/Observability/Test
1. 配置 flags 与默认值。
2. 增加关键 metrics。
3. 修复 e2e flag 污染，完成回归。
