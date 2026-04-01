# 05 Pitfalls — launch-gray-release-gap-closure (T-933)

## Do-not-repeat

- 不要把 `runDevSeed(profile='launch')` 和 `launch:warm-start` 混成一个入口，否则会破坏“轻 seed + 显式预热”的职责边界。
- 不要把 frontend build-time flags 和 backend runtime flags 放在同一个 overlay 里，否则后续很难判断“镜像编译值”和“部署时 env 值”谁是 SoT。
- 不要让 `verify:launch` 只检查 launch 专项资产而跳过 `lint/typecheck/build`，否则 repo 可以在工程基线失效时仍然显示 launch green。
- 不要只在镜像里生成 `frontend-build-flags.json` 却不把它通过 web role 暴露出来，否则 staging live gate 会因为无法读取 build proof 而天然假失败。
