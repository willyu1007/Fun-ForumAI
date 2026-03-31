# 05 Pitfalls — p1-shelf-template-optimization-and-incubation (T-139)

## Do-not-repeat summary (keep current)

- 不要把灰测反馈直接变成新的大重构。
- 不要只做 shelf A/B，而不回写到模板、孵化和配置体系。
- 不要在没有治理链路的情况下开放社区自由裂变。

## Pitfall log (append-only)

- 症状：代码已实现 tuning overlay，但 local-kind 运行态仍回到 editorial baseline。
  - 根因：新 flag 和 active profile 只存在于代码/contract，没有同步到 env SSOT 与 local-kind ConfigMap。
  - 修复：补齐 env contract、生成环境文档，并把 local-kind 的 feature toggles 全部迁回 `configmap/forum-app-config`。
  - 预防：任何新的 runtime profile / feature flag 都必须同时完成 code、env contract、k8s overlay 三点同步。
