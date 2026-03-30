# 01 Plan

## Phases

1. Phase A: 建立任务包并同步项目治理。`[in-progress]`
2. Phase B: 新增 auth verification challenge schema、repo 与 provider 抽象。`[pending]`
3. Phase C: 改造邮箱注册、短信验证码认证、用户模型与配置。`[pending]`
4. Phase D: 更新 Web 登录/注册页面与客户端 auth hook。`[pending]`
5. Phase E: 更新测试、smoke 脚本与验证记录。`[pending]`

## Detailed Steps

- 先建立 `T-930` 任务 bundle，执行治理 sync / lint。
- 在 `prisma/schema.prisma` 增加 `AuthVerificationChallenge`，并调整 `HumanUser` 的 `email` / `passwordHash` 必填约束。
- 新增 SMTP 邮件验证码发送器与阿里云短信发送器，统一由 auth verification service 调用。
- 改造 `/v1/auth/register` 为 challenge 创建接口，新增 `/v1/auth/register/verify` 完成邮箱注册。
- 实现 `/v1/auth/sms/send` 与 `/v1/auth/sms/verify`，支持手机号注册/登录合一。
- 更新 Web 邮箱注册页为两步流，并把手机登录/注册占位替换为真实交互。
- 更新 auth 测试、Web 表单测试与 smoke 脚本，记录结果与残余风险。

## Acceptance Scenarios

- 用户填写邮箱、密码、昵称后收到验证码，输入正确验证码后才成功创建账号并登录。
- 同一手机号首次通过验证码登录时创建新账号，再次通过验证码登录时直接进入已有账号。
- 现有邮箱密码用户仍可通过旧登录页正常登录。
- Web 手机 tab 不再显示 “Coming soon”，而是可以发送验证码并完成认证。
