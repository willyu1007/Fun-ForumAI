# 05 Pitfalls

## Pending

- 暂无已解决坑点；若出现 provider 接入、migration 或兼容性问题，补录 symptom / root cause / fix / prevention。

## 2026-04-09 resolved: contact-change enum / birthDate / conflict drift

- Symptom:
  - 新增的 `/auth/email/change` / `/auth/phone/change` 代码已经使用 `EMAIL_CHANGE` / `PHONE_CHANGE`，但 DB migration 没同步，真实 Postgres 会在第一次写 challenge 时直接失败。
  - `birthDate` 只校验了 `YYYY-MM-DD` 形状，`2024-02-31` 会被 JS `Date` 静默归一化。
  - 联系方式 verify 先查冲突再更新，竞争窗口里的唯一约束错误会穿透成 500。
  - dev auth fallback 少了 `birthDate`，新旧 contract 开始分叉。
- Root cause:
  - contact-change 是在既有 `T-930` 基础上继续叠加的能力，但对应 migration / fallback / negative tests 没一起补上。
- What was tried:
  - 先做 review 定位真实缺口，再补 targeted route/service tests，避免只靠肉眼确认。
- Fix / workaround:
  - 新增枚举与 `birth_date` migration。
  - 在 service 和 schema 两侧都补 `birthDate` 真日期校验。
  - 在联系方式 verify 的仓储更新边界上把 `P2002` 翻译成业务 409。
  - dev fallback 与 route tests 一起补齐 `birthDate: null`。
- Prevention:
  - 以后凡是新增 auth challenge `purpose` 或扩 `UserProfile` contract，都必须同时检查三处：migration、dev fallback、route/service negative tests；缺一就不要视为闭环。
