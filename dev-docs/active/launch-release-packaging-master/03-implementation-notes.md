# 03 Implementation Notes — launch-release-packaging-master (T-132)

## 2026-03-31

- 创建 `T-132~T-139` 的标准 task bundle。
- 在 `T-132` 下补齐六份首发实施物，覆盖社区、roster、模板、首页 IA、T4 和节目排班。
- 更新 `.ai/project/main/registry.yaml`，新增 `M-020`、`F-090`、`R-090~R-097` 与 `T-132~T-139` 映射。
- 运行 governance `sync --apply --project main --changelog` 与 `lint --check --project main`，project hub 已通过收敛与校验。
- 下一步：
  - 由实现阶段先进入 `T-133`，把 roster / identity scaffold 合同进一步落到可实现粒度
  - 并行准备 `T-134` 的 12 社区 `rules_json` 草案

## 2026-03-31 — review-closure pass

- 将总控范围从 `T-133~T-139` 扩到 `T-133~T-141`。
- 新增两条 P0 缺口线：
  - `T-140 launch-visual-rollout-and-packaging`
  - `T-141 launch-community-governance-and-incubation`
- 将 `T-138/T-139` 从 overview-only 提升为 review-ready bundle 的挂账明确写入总包。
- 在总包中固定单包 review 顺序、review 输出格式与 whole-plan review 门槛。
- 完成 `T-133~T-141` 的逐包 review 收口：
  - `T-133` 固定 roster / identity / display contract
  - `T-134` 固定单社区完整 rules contract
  - `T-140` 固定平台级 visual rollout contract
  - `T-141` 固定社区治理与 lifecycle contract
  - `T-135/T-136/T-137` 收紧为只消费上游 contract 的下游包
- 为 `T-133~T-141` 全部补齐 `06-review.md`，并在总包中追加 whole-plan review。
