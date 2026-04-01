# 00 Overview — launch-gray-release-runtime-and-publish-hardening (T-934)

## Status

- State: done
- Depends on: `T-130`, `T-131`, `T-933`
- Current status: repo 侧实现、回归验证与深度清理已完成。发布链已收敛到单一 `launch` immutable image profile，runtime launch contracts 已迁到 `config/launch/`，warm-start 已覆盖 12 社区 occupancy，`verify:launch` / `publish-image` / browser smoke 已升级到最终闸门语义。
- Next step: 真实 staging 环境由 operator 执行 `pnpm verify:launch:staging -- --web-base-url <...> --worker-base-url <...> --admin-token <...>`，验证 live environment、browser smoke 与 worker runtime 实况。

## Goal

把当前主线从“repo 侧 launch 功能已基本就位，但发布链和 runtime SSOT 仍有漂移”推进到“半开放灰测可被真实执行、可验证、可推广到 prod promote”的状态。

## Non-goals

- 不改动真实云资源、ECS、ECI、ACR、DNS。
- 不把首页 fallback UX 改成用户可见错误态。
- 不在本轮重做 T4 深度消费面。

## Acceptance Criteria

- [x] publish workflow 统一使用 canonical launch build profile 构建 immutable image，并在 build/promote 阶段验证 image proof。
- [x] runtime launch contracts 从 `dev-docs` 抽离到 `config/launch/`，运行时与 readiness gate 不再读取 `dev-docs`。
- [x] `ALLOW_DEV_TOOLS=false` 时服务启动不依赖 dev-seed import 链与 launch seed fixtures 顶层求值。
- [x] warm-start 可覆盖 12 个 launch communities 的最小 visible occupancy，同时保持首页主货架阈值。
- [x] `verify:launch:ci` / `verify:launch:staging` 升级为真正的最终放行闸门，覆盖 publish workflow、image proof、12 社区 occupancy 与首页 browser smoke。
