# 02 Architecture — launch-release-packaging-master (T-132)

## Workstream Split

- Foundation inputs
  - `T-924~T-927` 负责 bio 基础设施与多 surface 投放。
- P0 launch packaging
  - `T-133~T-137` 负责 roster、社区、首页/T4、节目运营。
  - `T-140` 负责平台级 visual rollout 与包装 contract。
  - `T-141` 负责社区新增治理、孵化与生命周期 contract。
- P1 follow-up
  - `T-138~T-139` 负责轻量个性化、relation hints、shelf/template/incubation 优化。

## Dependency Graph

- `T-132` 是总控与文档 SoT。
- `T-133` 依赖 `T-924~T-927`，提供身份脚手架与 roster 合同。
- `T-134` 冻结 12 社区合同与单社区 `rules_json` 骨架，并与 `T-133` 的 role vocabulary 对齐。
- `T-141` 冻结跨社区治理与 incubation contract，消费 `T-134` 的 community contract，但不重写单社区 `rules_json`。
- `T-140` 冻结平台级 visual rollout contract，供 `T-135`、`T-136`、`T-137` 共同消费。
- `T-135` 依赖 `T-134`、`T-140`、`T-137`，负责首页/主线/高光/aftershow 的前台语义。
- `T-136` 依赖 `T-134`、`T-140`，负责 T4 赛道与模板 registry。
- `T-137` 收敛 `T-133`、`T-134`、`T-140`、`T-141`、`T-135`、`T-136` 的运营面、节目单与 rollout。
- `T-138` 只在 P0 稳定后推进，叠加轻量 personalization 与 relation hints。
- `T-139` 只在 P0 稳定后推进，做 shelf/template/visual/incubation 的 post-launch tuning。

## Review Order

1. `T-132`
2. `T-133`
3. `T-134`
4. `T-141`
5. `T-140`
6. `T-135`
7. `T-136`
8. `T-137`
9. `T-138`
10. `T-139`
11. Whole-plan review

## Governance Mapping

- Milestone: `M-020 Launch Release Packaging`
- Feature: `F-090 Launch Identity & Programming`
- Requirements:
  - `R-090` 主任务与实施物
  - `R-091` system roster 与身份包装
  - `R-092` 12 社区与规则合同
  - `R-093` 首页 IA / storyline / highlights
  - `R-094` T4 社区能力化
  - `R-095` 节目运营与 rollout
  - `R-096` 轻量个性化与 relation hints
  - `R-097` shelf/template/post-launch tuning
  - `R-098` visual rollout 与节目包装
  - `R-099` 社区治理与 incubation

## Review Output Contract

每个 bundle 在离包前必须提供：

- `review_decisions`
- `contract_delta`
- `dependency_lock`
- `open_questions`
- `handoff_note`

若 `open_questions` 不为 `0`，不得进入下一个 bundle。
