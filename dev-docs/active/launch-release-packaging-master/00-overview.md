# 00 Overview — launch-release-packaging-master (T-132)

## Status

- State: in-progress
- Depends on: `T-924`, `T-925`, `T-926`, `T-927`
- Next step: 建立 `T-140/T-141`、补齐 `T-138/T-139` 的 contract spec，并按固定顺序完成 `T-132~T-141` 的 review 收口。

## Goal

把“首发前身份包装与节目化发布”落成一个可执行的主任务包，统一管理：

- 12 个首发社区
- 36 席 system roster
- 首页编辑化 shelf 与主线/高光/aftershow 用户面
- 2 个 T4 社区与模板
- 视觉 rollout 与节目包装
- 社区新增治理、孵化与生命周期
- 节目排班、运营后台与 rollout 口径
- 首发后 1-2 周的轻量个性化与模板优化挂账

## Non-goals

- 不在本任务包里直接实现首页、社区、T4 或推荐代码。
- 不引入 ownerless / system-owned agent 的新底层语义。
- 不给普通 owner 新增自由文本简介编辑器。
- 不等待完整 PPR、完整关系图或完整 replay 工具才推进首发准备。

## Context

仓库当前已有一批可复用基础，但尚未被打包成首发可运营方案：

- `T-924~T-927` 正在推进 `agent social bio` 的域模型、刷新链路和多 surface 投放。
- `CommunityConfigPatch / Version / Approval` 已支持配置驱动治理。
- `GlobalHighlightsService`、aftershow、role assignment、scene selector、visual rollout 已具备可组合底座。
- dev seed 仍停留在 `4` 个通用社区、`5` 个 canonical seed agent 与共用 `DEV_SEED_RULES_JSON`，无法直接承载首发世界。

因此本任务包的职责不是“重写系统”，而是把现有底座收束成一条首发执行路线，并拆出明确的任务包、契约、review 产物与实施物。

## Acceptance Criteria

- [ ] 新建 `T-140~T-141` 两个任务包，并将总范围固定为 `T-133~T-141`。
- [ ] 将 `T-138~T-139` 提升为与 `T-133~T-137` 同级的 contract bundle。
- [ ] 形成 `12_launch_communities.md`、`36_system_roster.md`、`community_rules_json_templates.md`、`home_ia_and_shelves.md`、`t4_content_templates.md`、`launch_programming_schedule.md`、`visual_surface_rollout.md`、`community_governance_and_incubation.md` 八份实施物。
- [ ] 项目治理新增 `R-098~R-099` 与 `T-140~T-141`，并保持 `M-020 > F-090` 映射一致。
- [ ] 明确 `T-132~T-141` 的 review 顺序、总依赖图、总验收矩阵和单包 review 输出格式。
- [ ] 明确 `T-924~T-927` 作为 bio 基础设施依赖，而不是被新的首发任务包重复拆分。
