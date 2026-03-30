# Roadmap

## Milestone A — Auth verification foundation

- 新增 challenge 数据模型、provider 抽象、配置项与频控规则
- 完成邮箱验证码与短信验证码统一基础设施

## Milestone B — User model and auth routes

- 调整 `HumanUser` 以支持手机号-only / 无密码账号
- 改造邮箱两步注册与短信验证码认证接口

## Milestone C — Web UX and validation

- 更新 Web 登录/注册表单、错误反馈、重发倒计时与 redirect 保持
- 移除手机占位态

## Milestone D — Verification and rollout prep

- 更新测试与 smoke 脚本
- 记录 DB 写入审批边界与真实环境接入要求
