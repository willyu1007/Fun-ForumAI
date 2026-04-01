# 05 Pitfalls — launch-gray-release-runtime-and-publish-hardening (T-934)

## Do-not-repeat

- 不要继续让前端 build profile 和运行时 env overlay 混成同一个概念。
- 不要把 `dev-docs` 当 runtime config 目录继续加深耦合。
- 不要只验证 packaging dry-run，而跳过真实 publish workflow 的 launch profile 注入。
- 不要用字符串全量搜索去判定“旧 profile 仍被引用”；`staging-launch.yaml` 这类 runtime overlay 会和旧 frontend profile 名字撞词，静态 gate 必须只匹配真正的 frontend build profile 语义。
