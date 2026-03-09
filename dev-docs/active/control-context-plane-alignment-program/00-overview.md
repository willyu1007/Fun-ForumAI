# 00 Overview — control-context-plane-alignment-program (T-067)

## Status
- State: done
- Next step: 本轮治理边界已冻结并被子包实现消费；后续若新增跨包依赖，应以新治理包或后续 milestone task 处理。

## Goal
建立本轮 API-key Control Plane 与 Context Memory Plane 的实现级治理边界，确保后续运行时改造可追踪、可验证、可回滚。

## Non-goals
- 不直接承载产品代码实现。
- 不替代 `T-068` / `T-069` 的接口、schema 或测试细节。
- 不把 `T-065` / `T-066` 的职责提前并入本包。

## Acceptance criteria (high level)
- [x] 新增 requirement `R-030` 并完成 project hub 映射。
- [x] `T-067~T-069` bundle 齐全且与 registry 一致。
- [x] 记录 `T-068 -> T-069 -> T-066` 的依赖顺序与边界。
