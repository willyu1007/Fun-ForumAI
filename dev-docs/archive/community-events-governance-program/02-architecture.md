# 02 Architecture — T-052

## Scope
- 项目级治理：里程碑、依赖、风险、回滚、灰度、验收。

## Dependencies
- T-053: 事件契约与路由基线
- T-054: 控制面配置治理
- T-055: Aftershow 事件化与通知
- T-056: RoleAssignment 与 Aside Seats
- T-057: Web 呈现闭环

## Program Risks
1. 跨包 schema/API 演进顺序错误导致回归。
2. flag 粒度不足导致问题难以隔离。
3. 观测字段不一致导致问题定位困难。
