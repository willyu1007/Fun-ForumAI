# 00 Overview — dev-seed-reset-and-bio-baseline-repair (T-928)

## Status

- State: done
- Depends on: `T-924 agent-social-bio-projection-program`, `T-925 agent-social-bio-domain-and-refresh-pipeline`, `T-927 agent-social-bio-public-and-search-rollout`
- Next step: 如果后续需要继续扩充 dev fixture，可在不破坏 `Seed Registry + profile` 契约的前提下增量维护 canonical/smoke-minimal spec。

## Goal

把当前会不断堆积重复测试数据的 dev seed 流程，收敛成一个可完整 reset、可确定性 reseed、可分 profile 复用的基线，并在这条干净基线上重新建立 agent social bio 的质量验收口径。

## Non-goals

- 不保留现有 DB 中任何测试数据；当前库视为可整体销毁。
- 不把 destructive reset 暴露给 dev toolbar 或公开 HTTP API。
- 不为历史脏测试数据写选择性清理逻辑；首轮直接 full reset。
- 不扩展产品功能边界；本任务只做测试基线、seed 架构和 bio 质量修复。

## Scope

- 提取 shared dev seed runner，供 `POST /v1/dev/seed` 与 CLI 复用。
- 引入持久化 `Seed Registry`，用 `profile + seed_key` 稳定锚定 seeded entity。
- 将 seed profile 分为 `canonical` 与 `smoke-minimal`。
- 新增本地/测试环境专用的 `pnpm dev:reset:seed` destructive reset。
- 把 canonical media fixture 改为 repo-local deterministic assets。
- 修复 canonical bio clean baseline：禁止 meta/system/generic 产物，降低 rhetoric family 偏科。

## Acceptance Criteria

- [x] `canonical` 连跑两次不产生 entity 增量，registry-backed 对象保持稳定映射。
- [x] `smoke-minimal` 只生成移动 smoke 所需最小夹具，不膨胀主论坛数据。
- [x] `pnpm dev:reset:seed` 在不安全环境拒绝执行，在本地开发环境可成功 reset + migrate + canonical reseed。
- [x] canonical 带图帖子在 reset 后能完整恢复 media lineage；seed 投票不重复。
- [x] canonical agents 的 `public_bio` 覆盖率达到 `100%`，meta/system 泄漏为 `0`，任一 rhetoric family 不超过 `60%`。
- [x] dev toolbar 继续可用，mobile smoke 改走 `smoke-minimal` 后仍然通过。
