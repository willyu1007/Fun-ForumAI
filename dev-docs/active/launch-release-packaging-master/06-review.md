# 06 Review — launch-release-packaging-master (T-132)

## review_decisions

- 总控范围从 `T-133~T-139` 扩为 `T-133~T-141`。
- 8 份实施物固定为首发总输入，不再停留在 6 份。
- `T-138/T-139` 必须先补成 review-ready bundle，再进入总 review。
- 单包 review 输出格式固定为 `review_decisions / contract_delta / dependency_lock / open_questions / handoff_note`。

## contract_delta

- 新增 requirement：`R-098`、`R-099`
- 新增 task：`T-140`、`T-141`
- 新增 master artifact：
  - `visual_surface_rollout.md`
  - `community_governance_and_incubation.md`

## dependency_lock

- `T-132` 只负责总依赖、总实施物、总验收矩阵与 whole-plan review。
- `T-132` 不重新定义各子包内部 contract，只负责指出 ownership。

## open_questions

- `0`

## handoff_note

- 下游 bundle 可以直接依赖 `T-132` 的 review 顺序、governance mapping、artifact list 与 dependency graph，不必重复定义总框架。

## whole_plan_review

### 覆盖度

- `13.1 P0` 已按 ownership 分配到 `T-133~T-141`：
  - 身份包装与 roster: `T-133`
  - 12 社区完整 contract: `T-134`
  - 社区新增治理链: `T-141`
  - 平台级 visual packaging: `T-140`
  - 首页节目化入口: `T-135`
  - T4 赛道 contract: `T-136`
  - 节目运营与回滚: `T-137`
- `13.2/13.3` 的 lightweight personalization 与 post-launch tuning 保持在 `T-138/T-139/P1`，未误升为 P0。

### 依赖闭合

- `T-133` 持有 roster / identity / display contract。
- `T-134` 持有单社区完整 contract。
- `T-141` 持有跨社区治理 / 生命周期状态机。
- `T-140` 持有平台级 visual rollout。
- `T-135/T-136/T-137` 只消费上游 contract，不再重复定义 ownership。
- `T-138/T-139` 只做 post-launch 增强与调优，不回写首发基础语义。

### 实施可执行性

- 每个任务包现在都具备：
  - `00-overview`
  - `01-plan`
  - `02-architecture`
  - `03-implementation-notes`
  - `04-verification`
  - `05-pitfalls`
  - `requirement.md`
  - working draft YAML / artifact
  - `06-review`
- 各包 `open_questions` 均收口为 `0`，实现者无需再做核心产品决策。

### 节奏可执行性

- 推荐顺序固定为：
  - `T-132`
  - `T-133`
  - `T-134`
  - `T-141`
  - `T-140`
  - `T-135`
  - `T-136`
  - `T-137`
  - `T-138`
  - `T-139`
- 允许并行的部分固定为：
  - `T-134` 与 `T-141` 可部分并行
  - `T-135` 与 `T-136` 可在 `T-140` 收口后并行

### 非目标保护

- 不把完整关系图、完整 replay、完整 season leaderboard 拉进 P0。
- 不让 system roster 侵入 owner 私域主链。
- 不把 T4 做成“只是多图”。
- 不让首页重新退回普通 feed 语义。
