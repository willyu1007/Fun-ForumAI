# 00 Overview — web-auth-email-and-sms-registration (T-930)

## Status

- State: done
- Depends on: none
- Current status: 本地 auth/contact-change 与 `birthDate` hardening、真实 SMTP 发信、本地与 staging 的 auth delivery smoke、bootstrap admin 与后台管理员权限链路均已完成；根据 2026-04-10 的 operator/user 确认，staging 真实 SMTP 已打通，且 staging 主流程已验证完成，因此本任务已无外部 blocker。
- Next step: 无。本任务已闭环，后续如扩展密码找回、账号合并或更多 delivery provider，应另开新任务包。

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

- `/v1/auth/register` 已切换为 challenge 两步注册，staging 真实 SMTP 与主流程联调已完成
- `/v1/auth/sms/send` 与 `/v1/auth/sms/verify` 已实现，staging 现已补齐 `ALIYUN_SMS_SIGN_NAME` / `ALIYUN_SMS_TEMPLATE_CODE`，SMS dry-run 已通过
- Web 的手机登录/注册表单已接到验证码流程
- `HumanUser` 已支持手机号-only、无密码账号
- 2026-04-09 已补齐 auth/contact-change 残余代码缺口：新增 `EMAIL_CHANGE` / `PHONE_CHANGE` enum migration、`birthDate` 真日期校验、联系方式 verify 的唯一约束竞争映射、以及 dev auth fallback 的 `birthDate` contract 对齐
- 邮箱验证码邮件已从传输层中拆出独立模板，并补强 `from/sender/envelope`，为后续邀请函模板预留结构
- 管控台已有邀请码页与反馈/治理入口，但还缺“管理员管理管理员”的最小操作面板
- 现已补上 bootstrap admin 配置、管理员列表与授予/撤销入口，继续沿用 `plan_tier = ADMIN` 权限模型
- 2026-04-10 已确认 staging 真实 SMTP 与 staging 主流程联调完成，不再存在 `talkshow-stag/smtp_user` / `talkshow-stag/smtp_pass` 阻塞

本任务将同时改动 Prisma schema、auth service/repository、配置、SMTP/阿里云短信 provider、Web auth 页面与测试脚本。

## Acceptance Criteria

- [x] 邮箱注册必须经过 6 位验证码验证后才能创建会话
- [x] SMTP 发信能力完成接入，支持重发、过期与错误回显
- [x] 短信验证码通过阿里云发送，手机号存在时直接登录，不存在时要求昵称并创建账号
- [x] `HumanUser` 支持手机号-only、无密码账号，不破坏既有邮箱密码账号登录
- [x] Web 登录/注册页移除手机占位，接入真实短信流程
- [x] 现有 smoke/test 脚本更新到新的邮箱注册 contract
- [x] 支持通过环境配置指定 bootstrap admin，匹配账号在注册/登录后自动获得 `ADMIN`
- [x] 现有 `ADMIN` 可以在后台查看管理员列表，并授予/撤销其他账号的管理员权限
