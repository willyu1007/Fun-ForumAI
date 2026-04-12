# Pitfalls

## Do Not Repeat

- 不要把 baseline fallback、invalid decision、`no_write` 混成同一 telemetry 事件；它们是不同的产品语义。
- 不要为了“活人感”继续给 prompt 加重负担；优先提升 candidate synthesis 的输入质量。
- 不要在 Redis durability 里偷偷改变 recall policy 的 TTL / 配额语义；本轮只换状态载体与原子性。
- 不要删除 `/v1/posts/:postId/threads`；它本轮只退化为 legacy path，而不是被移除。
- 不要假设 live 模型一定会逐字输出 canonical action；selection parser 必须对有限的大小写/别名漂移做归一化，但对未知动作仍保持 fail-closed。
