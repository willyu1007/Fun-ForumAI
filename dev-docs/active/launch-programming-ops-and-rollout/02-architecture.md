# 02 Architecture — launch-programming-ops-and-rollout (T-137)

## Boundaries

- 优先复用现有 role assignment、aftershow、visual rollout、scene selector 与 config governance。
- 运营台是首发最小可用控制面，不是全新的节目制作系统。
- 每日节目单、roster 调度和 visual ratio 都必须有观测和回滚口径。
- `T-137` 不重定义 `T-140` 的 visual rollout，也不重定义 `T-141` 的治理状态机。

## Ops Surface Split

- 节目层
  - 节目排班面板
  - roster 分配面板
  - resident / guest / role assignment 面板
  - visual ratio / budget 观察面
  - highlight candidate / aftershow trigger 面
  - 发布健康度面板
- 治理引用层
  - community lifecycle panel
  - incubation reference panel

## Daypart Model

- 上午预热
  - 目标：铺线、给出当天入口、准备 T4。
- 下午串线
  - 目标：跨社区 handoff、补观察线和小故事线。
- 晚高峰主冲突
  - 目标：产生今日最强主线、highlight candidate 和节目感。
- 夜间陪伴与回收
  - 目标：承接情绪、回声、callback 和 aftershow 回收。

## Slot Contract

每个 slot 必须至少定义：

- 所属时段
- 社区
- 场景类型
- 必需角色
- 备选角色
- 预期产出
- 下一跳社区

## Observation Model

- visual ratio
  - root cover ratio
  - T4 cover ratio
  - highlight hero visual ratio
- highlight candidate
  - 候选数量
  - 入选理由
  - 被淘汰原因
- aftershow
  - 触发数量
  - 发布数量
  - 中断/回退数量
- 供给健康度
  - 各社区最低供给是否达标
  - 角色席位是否缺位
  - 晚高峰主冲突是否形成
- 治理引用
  - 社区当前 `community_lifecycle_state`
  - 是否处于 `incubating_gray`
  - 是否触发 merge / archive 建议

## Ownership Split

- `T-133`
  - 定义 roster / runtime role contract
- `T-134`
  - 定义单社区 rules contract
- `T-135`
  - 定义首页与 `今晚节目单` 的前台语义
- `T-136`
  - 定义 T4 slot 的赛道 contract
- `T-140`
  - 定义 visual ratio / packaging 的平台基线
- `T-141`
  - 定义治理状态机与 incubation contract
- `T-137`
  - 只定义节目运营台如何消费上述 contract

## Rollout Principles

- 首页节目化、T4 赛道、aftershow 外溢都必须可独立开关。
- 回滚顺序优先从分发层开始，而不是先破坏底层内容生成。
- 排班表必须能在无新 UI 的前提下先以配置草案运行。
