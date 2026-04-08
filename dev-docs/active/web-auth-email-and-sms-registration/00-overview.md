# 00 Overview — web-auth-email-and-sms-registration (T-930)

## Status

- State: in-progress
- Depends on: none
- Next step: staging 已补齐非 secret 投递参数；现在只剩校正 `talkshow-stag/smtp_user` / `talkshow-stag/smtp_pass` 这组 SMTP secret，然后用 `node scripts/auth-delivery-smoke.mjs` 做真实发信验证。

## Goal

补完 Web 端邮箱与短信注册链路：

- 邮箱注册改为“提交资料 -> 收取 6 位验证码 -> 验证成功后创建账号并登录”
- 短信注册接入真实阿里云短信服务，完成验证码发送与校验
- 手机号登录/注册走统一验证码入口，手机号不存在时新建账号，已存在时直接登录
- 为短信账号支持“手机号-only、无密码”模型

## Non-goals

- 不补移动端注册 UI
- 不做邮箱 magic link、微信登录或密码找回
- 不做账号合并、手机号/邮箱后补绑定流程
- 不把 DB migration 应用到真实环境数据库；真实 DB 写入须单独审批

## Context

任务推进后，当前仓库状态：

- `/v1/auth/register` 已切换为 challenge 两步注册，staging 现已补齐 `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_FROM_EMAIL`，并确认当前剩余问题收敛到 SMTP secret 认证失败
- `/v1/auth/sms/send` 与 `/v1/auth/sms/verify` 已实现，staging 现已补齐 `ALIYUN_SMS_SIGN_NAME` / `ALIYUN_SMS_TEMPLATE_CODE`，SMS dry-run 已通过
- Web 的手机登录/注册表单已接到验证码流程
- `HumanUser` 已支持手机号-only、无密码账号
- 邮箱验证码邮件已从传输层中拆出独立模板，并补强 `from/sender/envelope`，为后续邀请函模板预留结构
- 管控台已有邀请码页与反馈/治理入口，但还缺“管理员管理管理员”的最小操作面板
- 现已补上 bootstrap admin 配置、管理员列表与授予/撤销入口，继续沿用 `plan_tier = ADMIN` 权限模型

本任务将同时改动 Prisma schema、auth service/repository、配置、SMTP/阿里云短信 provider、Web auth 页面与测试脚本。

## Acceptance Criteria

- [ ] 邮箱注册必须经过 6 位验证码验证后才能创建会话
- [ ] SMTP 发信能力完成接入，支持重发、过期与错误回显
- [ ] 短信验证码通过阿里云发送，手机号存在时直接登录，不存在时要求昵称并创建账号
- [ ] `HumanUser` 支持手机号-only、无密码账号，不破坏既有邮箱密码账号登录
- [ ] Web 登录/注册页移除手机占位，接入真实短信流程
- [ ] 现有 smoke/test 脚本更新到新的邮箱注册 contract
- [ ] 支持通过环境配置指定 bootstrap admin，匹配账号在注册/登录后自动获得 `ADMIN`
- [ ] 现有 `ADMIN` 可以在后台查看管理员列表，并授予/撤销其他账号的管理员权限
