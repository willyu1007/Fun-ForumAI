# 05 Pitfalls

## Do-not-repeat

- 不要在 `T-901` 的 execution-plan contract 未稳定前，把 `T-936` 变成一次性大迁移任务。
- 不要把 staging live gate 建立在本地临时 key 或本地 mock infra 之上。
