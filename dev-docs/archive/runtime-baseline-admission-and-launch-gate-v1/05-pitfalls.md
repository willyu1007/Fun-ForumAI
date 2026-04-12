# 05 Pitfalls

## Do-Not-Repeat Summary

- 不要把“worker 进程已启动”误写成“runtime 已可对外生产”。
- 不要只在脚本层做 baseline 检查而不在服务层加 guard；脚本不是安全边界。
- 不要忘记 warm-up top-up 的 lineage 继承；这是最容易漏掉的逃逸口。
- 不要把 programming/media/aftershow 健康信号直接绑定到 `allow_public_growth`；这些信号在首发前更多是 advisory，而不是基线激活闸门。
- 不要再用根路径 `/` 作为 launch home smoke 入口；当前 forum public launch home 的稳定入口是 `/recommended`。

## Resolved Lessons

- 症状: active baseline 已存在，但 `allow_public_growth=false`，`verify:launch:staging` 卡在 `community_supply_floor_not_ready / media_access_not_ready / aftershow_pipeline_not_ready`。
- 根因: runtime admission 把 baseline gate 与 programming health 混成一层，导致 advisory 信号错误阻断放量。
- 修正: `allow_public_growth` 改为只由 `active baseline + kickoff/warmup active + fresh pass review` 决定，programming/media/aftershow 状态继续暴露在 read model 中供运营观察。
- 预防: 以后新增 readiness 字段时，必须先标明它属于 `hard gate` 还是 `advisory health`。
