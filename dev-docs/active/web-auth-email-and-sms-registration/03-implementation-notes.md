# 03 Implementation Notes

## 2026-03-30

- 创建 `T-930` 任务 bundle，锁定范围为 Web 邮箱/短信注册补完。
- 记录当前环境约束：`node` / `pnpm` 已安装于 `/opt/homebrew/bin`，但不在默认 PATH，需要用绝对路径执行治理与验证脚本。
- DB apply 审批未执行；本次只会修改 SSOT、migration 文件、代码与测试。
- 完成 Prisma SSOT 变更：
  - `HumanUser.email` / `passwordHash` 改为可空，支持手机号-only、无密码账号。
  - 新增 `AuthVerificationChallenge` 模型与配套 migration，用于邮箱/SMS 验证码存储、重发与限频。
- 重写后端 auth 链路：
  - 邮箱注册改为 `POST /auth/register -> /auth/register/verify -> session`
  - 新增 `/auth/register/resend`
  - 实现 `/auth/sms/send`、`/auth/sms/verify`、`/auth/sms/resend`
  - `AuthService` 现在负责验证码签发、校验、重发冷却、每目标/IP 限频，以及短信注册登录合一逻辑。
- 增加 provider 抽象：
  - SMTP 发信走 `nodemailer`
  - 阿里云短信走 `@alicloud/dysmsapi20170525`
  - 本地 / test 环境回退为日志 sender，并通过 `debugCode` 支持测试与 smoke 脚本消费验证码。
- 重写 Web auth 前端：
  - `EmailRegisterForm` 改为两步验证码流程
  - 登录/注册页统一直接复用 `PhoneAuthForm`
  - `useAuth` 与 `src/frontend/api/auth.ts` 切换到新 challenge contract
- 更新配套内容：
  - `scripts/mobile-smoke-prepare.mjs` 改为 challenge + verify 形式
  - `env/contract.yaml`、secret refs、`env/.env.example`、`docs/env.md`、`docs/context/env/contract.json` 已同步
  - `docs/context/db/schema.json` 已刷新
- 为了让全量 `eslint` 通过，顺手修复了两个仓内既有的轻量 lint 问题：
  - `src/backend/domain/agent-bio/fingerprint.ts`
  - `src/backend/services/agent-bio-worldview-service.ts`
- review 轮额外修复的 auth 质量问题：
  - 短信首次注册漏填昵称时，不再提前消费验证码
  - PG challenge 核销在并发场景下改为返回稳定状态，不再依赖脆弱的单次 update
  - 生产态未配置 SMTP / 阿里云短信时，不再在启动期直接抛错，而是在请求发送验证码时返回明确 provider unavailable 错误
- 邮件品牌化与 anti-spam 收口：
  - 新增 `src/backend/services/auth-email-template.ts`，把验证码邮件的主题、纯文本、HTML、headers 与 sender policy 从 transport 中拆出
  - 邮件主题改为 `AI Talkshow 注册验证码`，正文补充品牌语境、忽略说明和“不要转发验证码”的安全提示
  - SMTP 发件时显式设置 `from` / `sender` / `envelope`，并增加 `Auto-Submitted`、`X-Auto-Response-Suppress` 头，降低客户端回退到底层 sender identity 的概率
  - 当前只收口验证码邮件；真正的“邀请函”模板需等邀请码/邀请链接链路落地后再接入，但边界已预留
- 收尾清理：
  - 删除仅用于传递 `mode` 的 `PhoneLoginForm` / `PhoneRegisterForm` 包装文件，页面直接依赖 `PhoneAuthForm`
  - 删除已失效的本地 env doctor 产物 `artifacts/env-local/00-prereq-check.md`

## 2026-04-02

- 将 bootstrap admin / admin 授权能力并入 `T-930`，不新开任务包：
  - 继续沿用现有 `plan_tier = ADMIN` 权限模型，不引入新的 RBAC schema
  - bootstrap admin 不做永久硬编码白名单，而是改为环境配置驱动，避免把真实管理员标识写死在业务代码中
- 设计约束确认：
  - bootstrap admin 配置匹配邮箱/手机号，账号在登录或注册成功后自动提权为 `ADMIN`
  - 现有管理员通过管控台查看管理员列表，并授予/撤销其他账号管理员权限
  - bootstrap admin 账号禁止在后台被撤销，避免撤销后下次登录自动恢复造成困惑
- 已完成的代码落地：
  - `config.auth.bootstrapAdmins` 新增邮箱/手机号列表配置，`AuthService` 在邮箱登录、邮箱注册完成、短信注册/登录完成后统一调用 `finalizeAuthUser` 做 bootstrap 提权
  - `UserRepository` / `PgUserRepository` 新增 `listAdmins` 与 `updatePlanTier`，提供最小管理员管理能力
  - 新增 `AdminUserAccessService`，集中处理 bootstrap admin 判断、管理员列表、授予管理员、撤销管理员与保护规则
  - `admin-api` 新增 `/admin/admin-users`、`/admin/admin-users/grant`、`/admin/admin-users/:userId/revoke`
  - 管控台新增 `AdminUsersTab`，支持通过邮箱/手机号授予管理员，并在列表中区分 bootstrap admin
  - 为避免现有 `plan_tier` 模型吞掉付费等级，对 `PRO` 账号授予管理员时改为显式报错 `ADMIN_PLAN_TIER_CONFLICT`
  - bootstrap 自动提权也收紧为仅对 `FREE` 账号生效；如果配置命中了 `PRO` 账号，登录会保持原套餐等级，不再发生静默降级
- 额外顺手修复：
  - `env-contractctl` 之前被 `staging-launch` / `prod-launch` 缺失 secret ref 文件阻塞，这轮补齐了两个 launch 环境的 secret refs，让 env contract 重新可生成

## 2026-04-07

- 增加可复用的 auth provider 联调入口：`node scripts/auth-delivery-smoke.mjs`
  - 支持 `--mode smtp|sms|both`
  - 支持 `--env-file`、`--smtp-verify-only`、`--dry-run`
  - 默认输出做过脱敏的配置摘要，避免在联调时把凭据直接打到终端或验证记录
- 把 auth delivery smoke 命令写入 `ops/deploy/handbook/runbooks/deployment-mainline.md`，让 operator 在首轮 staging/prod 认证链路发布前有固定检查步骤
- 用新脚本复查 staging auth delivery 配置后，确认当前环境缺口并不在代码，而在 cloud env values：
  - SMTP 缺 `SMTP_HOST`、`SMTP_FROM_EMAIL`
  - 阿里云短信缺 `ALIYUN_SMS_SIGN_NAME`、`ALIYUN_SMS_TEMPLATE_CODE`
  - 因此 `T-930` 的剩余 blocker 已收敛为“补齐这 4 个非 secret env 值并执行真实 smoke”，而不是继续修改 auth 业务实现
- 随后已把上述 4 个非 secret 值从本地可用配置回填到 `env/values/staging.yaml`，并同步到当前 `ops/deploy/env-files/staging.env` 用于即时联调。
- 新一轮 smoke 结果表明：
  - SMS 已无配置缺口，dry-run 通过
  - SMTP 网络参数也已正确，`smtpdm.aliyun.com:465` + TLS 可以握手到鉴权阶段
  - staging 现在剩余的真实 blocker 是 Bitwarden 中 `talkshow-stag/smtp_user` / `talkshow-stag/smtp_pass` 与本地可用凭据不一致，导致 535 Authentication failure

## 2026-04-09

- 按未推送的 auth/contact-change review 结果做了一轮本地 hardening，不新开任务包，继续记在 `T-930`：
  - 新增 migration `20260409213000_t930_contact_change_birth_date_hardening`，补上 `AuthVerificationPurpose` 的 `EMAIL_CHANGE` / `PHONE_CHANGE` 枚举值，以及 `human_users.birth_date`
  - `AuthService.updateProfile()` 改为显式解析并校验真实生日；`2024-02-31` 这类输入现在会稳定返回 `INVALID_BIRTH_DATE`，不再被 JS `Date` 静默归一化成别的日期
  - 联系方式变更 verify 路径补上晚到唯一约束冲突映射：`userRepo.updateEmail()` / `updatePhone()` 如果在竞争窗口里抛出 `P2002`，现在会被翻译成稳定的 409 业务错误，而不是全局 500
  - dev auth fallback（`app.ts` 的 dev-only `/auth/me` 与 `auth-api.ts` 的 `_devToken` fallback）补齐 `birthDate: null`，避免 `UserProfile` contract 再次出现分支漂移
- 补齐后端回归：
  - `auth-service.test.ts` 新增 `birthDate` 非法日期拒绝用例
  - `auth-service.test.ts` 新增联系方式变更 verify 的晚到唯一冲突映射用例
  - `auth-api.test.ts` 新增 authenticated `birthDate` 持久化、非法日历日期拒绝、邮箱变更 resend/旧 challenge 失效、手机号变更成功、dev `/auth/me` contract 对齐等用例
