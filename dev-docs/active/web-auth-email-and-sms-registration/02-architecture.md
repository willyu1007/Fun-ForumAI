# 02 Architecture

## Boundaries

- Routes 只负责 request/response wiring 与 schema validation。
- `AuthService` 继续承接业务规则，但把验证码发送/校验拆到独立 verification service。
- Repository 隔离 challenge 与 user 持久化；service 不直接依赖 Prisma client。
- Provider 层隔离 SMTP 与阿里云短信 SDK，避免在 auth route/service 中出现供应商细节。

## Data Model Decisions

- `HumanUser.email` 改为 nullable unique，支持手机号-only 账号。
- `HumanUser.passwordHash` 改为 nullable，支持短信无密码账号。
- 新增 `AuthVerificationChallenge` 持久化验证码 hash、目标地址、用途、过期时间、重发/尝试计数和附加 payload。

## Request Flow

### Email signup

1. `/v1/auth/register` 校验邮箱未占用与密码规则
2. 创建或覆盖 `EMAIL_SIGNUP` challenge，payload 内保存待创建资料
3. 发送 SMTP 验证码
4. `/v1/auth/register/verify` 校验验证码，创建用户并发 token/cookie

### SMS auth

1. `/v1/auth/sms/send` 校验手机号，创建或覆盖 `SMS_AUTH` challenge
2. 通过阿里云短信发送验证码
3. `/v1/auth/sms/verify` 校验验证码
4. 若手机号已存在则直接登录；否则要求 `displayName` 并创建账号

## Risks

- `HumanUser` nullable 改动会影响所有 user repository mapping 与密码登录分支。
- 当前 shell 的 `node` / `pnpm` 不在 PATH，需要使用绝对路径进行验证与脚本运行。
- 真实 DB apply 不在本次执行范围内，migration 只生成 repo 侧变更与 SQL。
