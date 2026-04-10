# 05 Pitfalls

## Do-not-repeat summary

- 不要把 `T-944` 当作“还能继续往里塞 residual scope”的杂项包。
- 不要在 `T-945` anchor semantics 尚未冻结前写死 broker/recall 行为。
- 不要把 recall 的 suppress 逻辑继续做成跨 thread 的全局 pair cache。
