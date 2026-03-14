# 02 Architecture — T-050

## Boundaries
- Backend service/repo/router 层修复，不改前端数据协议核心结构。
- Stage template 资产继续存放于仓库的场景模板 source 目录中。
- 生产运维策略由 API guard + 脚本流程共同约束。

## Key Interface Changes
1. Membership repository 增加 current community 查询接口。
2. Incubation review 响应增加 `next_action`。
3. Stage template IO 统一 YAML 语义。

## Risk Controls
1. 安全：封禁恢复路径单一化（只能 status API）。
2. 一致性：flag 分层清晰（membership existence gate vs status gate）。
3. 可用性：stage fallback 放宽运行门槛并保留告警。
4. 运维：生产禁 API 实写，避免多副本/只读文件系统不一致。
