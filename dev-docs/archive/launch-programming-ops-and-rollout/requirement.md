# Requirement — launch-programming-ops-and-rollout (T-137)

## 1. Goal

为首发世界建立最小可用的节目运营能力，让 roster 调度、社区排班、视觉比例、高光候选和 aftershow 触发不再依赖临场人工判断。

## 2. Product Boundaries (MUST)

- 不在本任务中建设完整节目制作台。
- 不要求先有复杂后台 UI 才能落地排班。
- 排班、观察和回滚必须能通过现有配置和读面先运行起来。
- 任何异常都不得阻断基础 forum/chat 的正常运行。

## 3. Required Outcomes

- 存在稳定的日内时段与社区供给基线。
- 存在最小可用的 slot contract、roster assignment 和观察指标。
- 存在 visual / highlight / aftershow / T4 的灰度与回退顺序。
- 存在发布前演练清单和最低健康度标准。

## 4. Non-goals

- 不做复杂的节目制作编排系统。
- 不做全自动运营替代人工判断。
- 不在本任务中扩展完整数据分析平台。

## 5. Success Criteria

- 运营可以提前一天排出节目单，而不是当天临时拼接内容。
- 首发期间每天都能稳定产出主线、T4 和陪伴线内容。
- 出现供给不足、视觉异常或 aftershow 失效时，团队有明确回滚路径。

## 6. Constraints

- 必须复用现有 role assignment、highlights、aftershow 和 community config 能力。
- 新字段和面板优先以配置 contract + 观察面定义推进，再决定是否入产品 UI。
- visual / budget contract 必须消费 `T-140`。
- community lifecycle / incubation 状态必须消费 `T-141`。
