# 05 Pitfalls

## Do-Not-Repeat Summary

- 不要把最小 admin UI 做成只读面板；本轮目标明确要求“可点审、可治理”。
- 不要只支持按 post id 治理；batch/slice 是本包成立的前提。
- 不要先实现 `purge` 再定义保护边界；高破坏动作必须最后落地。
- 不要让 admin 面板各 tab 自行假设基础 DTO 形状；`/health` 这类基础接口漂移会直接把控制台打崩。

## Resolved Lessons

- 症状: `/admin` 在本地真实访问时因 `healthData.data.status` 访问不存在字段而崩溃。
- 根因: 前端沿用了旧 `/health` DTO 假设，和 backend 当前 `{ ok, service, checks, version, ts }` 真实形状不一致。
- 修正: 对齐 `HealthData` 类型与 `useHealth()` 返回结构，并更新 AdminPanel 状态条读取逻辑。
- 预防: admin 基础读面优先复用共享 DTO，不再在页面内临时假设嵌套字段。
