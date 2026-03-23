# 03 Implementation Notes

## Initialization

- 2026-03-23: 创建 `T-917` 标准 bundle，并把任务状态置为 `planned`。
- 2026-03-23: 明确该任务只在 `T-916` 完整 cutover 后启动，不并行执行。
- 2026-03-23: 第二轮复核把 director/media/relation/source-enum 清理纳入 removal inventory，避免只删主链代码留下隐形双轨。

## Frozen Decisions

- `T-917` 是 semantic cleanup，不是机械删除。
- 清理后的 repo 不保留 comment-tree 主路径 alias。
- anti-drift guard 是长期治理要求，不是一次性脚本。

## Implementation Notes To Fill During Execution

- 实际删除的模块清单与 PR 拆分策略。
- anti-drift guard 的具体实现方式与例外目录配置。
- repo-wide 验证命令、结果与残余风险。
