# 05 Pitfalls

## Do-not-repeat summary

- 不要 reopen `T-144` 并覆盖已冻结的三轴语义。
- 不要让新 forest 入口继续调用旧 read-router 写接口。
- 不要把 stage reply 降回只能回复 thread root。
