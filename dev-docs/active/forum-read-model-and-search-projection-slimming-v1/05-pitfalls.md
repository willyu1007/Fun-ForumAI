# 05 Pitfalls

## Do-not-repeat summary

- 不要把这个包做成“顺手换 public API”的重构包。
- 不要让 `T-915` 继续拥有论坛主读模型重构，否则 search 任务又会吞掉 forum performance ownership。
- 不要在没有 hot-path inventory 的情况下直接改 repository/service，容易做成“换了接口名但热路径没变”。
