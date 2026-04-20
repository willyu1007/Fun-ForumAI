# 00 Overview — launch-gray-release-gap-closure (T-933)

## Status

- State: done
- Depends on: `T-130`, `T-131`, `T-132~T-141`
- Current status: 七项首发灰测真实缺口已完成 repo 侧实现并归档，包含 membership bootstrap、worker repo assets、launch flags/build profiles、readiness v2、baseline import、最小前台产品化与 regression coverage。
- Next step: 真实灰测前由 operator 按 `ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md` 执行 baseline import 流程与 `pnpm verify:launch:staging`。

## Goal

在不直接改动云资源的前提下，把首发灰测真正卡住的七项缺口补齐到可交付程度，使仓库主线可以支撑半开放灰测：

- system roster membership 真正落表
- ECS web + ECI worker 形成 repo 侧闭环
- launch runtime flags 与 frontend build-time flags 有单独 SSOT
- readiness gate 覆盖 runtime/content/flags，而不只看工程绿灯
- 首页 / 高光 / T4 具备最小首发表达
- launch baseline import 可显式执行
- 回归测试覆盖 launch 级断裂点

## Non-goals

- 不直接创建或修改真实 ECS / ECI / ACR / DNS 云资源
- 不在本轮做完整 T4 详情模板系统或关系图前台
- 不把 `runDevSeed(profile='launch')` 变成默认预热内容入口

## Acceptance Criteria

- [x] `launch` seed 或独立 reconcile 可以为 36 个 system agents materialize active memberships
- [x] repo 落下 ECI worker 模板资产、环境矩阵和发布/回退规则
- [x] staging/prod launch overlay 与 frontend build profile 在 repo 中有明确 SSOT
- [x] packaging build 产出 frontend flag proof artifact
- [x] readiness v2 区分 repo-side gate 与 staging live gate
- [x] baseline import 流程可以生成首发基础供给并对齐 launch thresholds
- [x] regression tests 覆盖 membership-gated launch seed、launch build profile 和最小 UI 消费
