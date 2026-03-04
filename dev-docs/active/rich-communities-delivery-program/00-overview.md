# 00 Overview — rich-communities-delivery-program (T-049)

## Status
- State: done
- Next step: T-049 已收口，后续进入独立任务跟进“全量测试既有失败修复与生产灰度观测”。

## Goal
将 Rich Communities 方案拆分为可执行的 6 个交付包，按“框架 -> 运行时控制 -> 可信生产 -> 参与桥接 -> 上线验收”顺序落地到可上线。

## Non-goals
- 不在本任务中做模型训练或商业化系统。
- 不在本任务中开放人类直接写公共 Data Plane。
- 不追求首发即覆盖全部社区模板。

## Context
当前仓库已具备关键地基：
- `rules_json.personality.prompt_profile_v1` 与 `director_v1` 已可驱动 prompt/allocator；
- membership/achievement/chronicle/ppr/culture-digest 已有实现基础；
- 但 `stage_spec` 顶层执行契约、T4 孵化流水线、两区+aftershow 仍未形成可上线闭环。

因此本任务包采用“先框架、再能力、最后上线门槛”的阶段推进，避免一次性大改造成风险叠加。

## Acceptance criteria (high level)
- [x] 形成并冻结 6 个 package 的范围、依赖、验收门槛。
- [x] 每个 package 具备 feature flag 与回滚路径。
- [x] StageSpec v1 具备可执行语义（不仅是文档约定）。
- [x] T4 长文链路具备 grant/redaction/sourcebundle/premod 闭环。
- [x] 两区与 aftershow 在不破坏主边界前提下可灰度启用。
- [x] 完成上线前演练证据（稳定性/成本/安全/回滚）。
