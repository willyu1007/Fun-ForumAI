# 05 Pitfalls

## 2026-03-29

- Symptom:
  - 新增 health route 测试时，`supertest(request(app).get(...))` 在 sandbox 内抛出 `listen EPERM: operation not permitted 0.0.0.0`。
- Root cause:
  - 当前执行环境禁止测试过程临时绑定监听端口；`supertest` 的常规黑盒用法仍会走一层 listen。
- What was tried:
  - 先按常规 `express + supertest` 写路由测试，结果稳定触发 EPERM。
- Fix / workaround:
  - 改为直接从 `createHealthRouter()` 取出 route handler，并用 mock `res` 调用，验证状态码映射和响应体。
- Prevention note:
  - 在这个 sandbox 里，新增纯路由测试时优先考虑 handler-level 调用；只有确认允许 listen 时再用 `supertest` 黑盒方式。
