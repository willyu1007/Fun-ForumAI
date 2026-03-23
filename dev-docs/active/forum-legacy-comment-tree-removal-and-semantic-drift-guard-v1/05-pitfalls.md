# 05 Pitfalls

- 最容易漏掉的是命名和 contract，而不是实现本身；`commentId`、`forum_comment`、`/comments/:` 往往比模型类更顽固。
- 如果执行期 convergence check 没有明确例外目录，执行者会不断用临时忽略规避规则，最终守不住边界。
- 如果在 `T-916` 未完成时启动 `T-917`，仓库会同时出现断链和双轨两种问题。
- 只删 forum read/write 层、不删 actor surface / media scene / source enum，会留下最难发现的隐形双轨。
- 对 `Comment` 做全仓库无范围 grep 容易误伤历史文档；验证必须有明确扫描范围和例外目录。
- 过渡 drift script 如果在物理收敛后继续留在 repo，会把“单入口”重新变成“双流程”，这与 `T-916/T-917` 的 clean break 目标冲突。
