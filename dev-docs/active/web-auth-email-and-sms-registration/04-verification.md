# 04 Verification

## Completed

- Project governance
  - `/opt/homebrew/bin/node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
    - 结果：`[ok] Sync complete.`
  - `/opt/homebrew/bin/node .ai/scripts/ctl-project-governance.mjs lint --project main`
    - 结果：`[ok] Lint passed.`

- Prisma / DB context
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec prisma generate`
    - 结果：Prisma Client v7.4.1 生成成功
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec prisma validate`
    - 结果：`The schema at prisma/schema.prisma is valid`
  - `/opt/homebrew/bin/node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
    - 结果：`[ok] Context DB contract updated.`
    - 备注：`ctl-context touch` 返回 failed，但 `docs/context/db/schema.json` 已刷新

- Type / lint
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec tsc --noEmit --pretty false`
    - 结果：通过
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm lint`
    - 结果：通过

- Targeted tests
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec vitest run src/backend/routes/__tests__/auth-api.test.ts src/backend/services/__tests__/auth-service.test.ts src/backend/services/__tests__/auth-delivery.test.ts src/backend/repos/__tests__/pg-auth-verification-challenge-repository.test.ts src/frontend/features/auth/components/__tests__/AuthRedirectForms.test.tsx src/frontend/features/auth/pages/__tests__/AuthPageRedirect.test.tsx`
    - 结果：`6` 个 test files，`16` 个 tests 全部通过
    - 覆盖：
      - 邮箱 challenge 注册
      - 邮箱 resend 后旧 challenge 失效
      - 短信注册/登录合一
      - 首次短信注册缺少昵称时验证码不被提前消费
      - 生产态 provider 未配置时 sender 行为
      - PG challenge 核销并发竞态回退
      - auth 页面 redirect、邮箱两步注册表单 redirect
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec vitest run src/backend/services/__tests__/auth-email-template.test.ts src/backend/services/__tests__/auth-delivery.test.ts`
    - 结果：`2` 个 test files，`4` 个 tests 全部通过
    - 覆盖：
      - 邮箱验证码模板的品牌主题、文本/HTML、sender/envelope/headers
      - 生产态 provider 未配置时 sender 行为

- Real SMTP smoke
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/node --input-type=module - <<'EOF' ... transport.verify() ... EOF`
    - 结果：`SMTP_VERIFY_OK`
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec tsx --eval \"... createEmailVerificationSender().sendVerificationCode(...) ...\"`
    - 结果：真实 SMTP 发信成功，测试邮箱收到新版验证码邮件

- Environment contract
  - `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/web-auth-email-and-sms-registration/artifacts/env/03-validation-log.md`
    - 结果：通过
  - `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/active/web-auth-email-and-sms-registration/artifacts/env/04-context-refresh.md`
    - 结果：通过
  - `/opt/homebrew/bin/node .ai/tests/run.mjs --suite environment`
    - 结果：`PASS`

- Bootstrap admin / admin access rollout
  - `PATH=/opt/homebrew/bin:$PATH pnpm exec tsc --noEmit --pretty false`
    - 结果：通过
  - `PATH=/opt/homebrew/bin:$PATH pnpm exec vitest run src/backend/services/__tests__/auth-service.test.ts src/backend/services/__tests__/admin-user-access-service.test.ts src/backend/routes/__tests__/admin-user-access-api.test.ts src/frontend/features/admin/pages/admin-panel/__tests__/AdminUsersTab.test.tsx src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
    - 结果：`5` 个 test files，`17` 个 tests 全部通过
    - 覆盖：
      - bootstrap admin 在邮箱登录后自动升级为 `ADMIN`
      - bootstrap 配置命中 `PRO` 账号时不会静默降级
      - bootstrap admin 撤销保护与 self-revoke 限制
      - `PRO` 账号不会被静默提成 `ADMIN` 并丢失原套餐等级
      - `/admin/admin-users` 列表、授予、撤销路由
      - 管控台管理员页的授予与撤销交互
      - `AdminPanel` 新页签集成
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
    - 结果：通过
  - `/opt/homebrew/bin/node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
    - 结果：`[ok] Sync complete.`
  - `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root .`
    - 结果：通过
  - `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root .`
    - 结果：通过，刷新 `env/.env.example`、`docs/env.md`、`docs/context/env/contract.json`
  - `/opt/homebrew/bin/node .ai/tests/run.mjs --suite environment`
    - 结果：`PASS`
  - `git diff --check`
    - 结果：通过，无空白或冲突标记问题

- 2026-04-07 auth delivery smoke
  - `node scripts/auth-delivery-smoke.mjs --help`
    - 结果：通过；联调脚本可执行，usage 已落仓
  - `node scripts/auth-delivery-smoke.mjs --mode smtp --env-file ops/deploy/env-files/staging.env --smtp-verify-only`
    - 结果：失败；脚本成功识别出 staging env 缺 `SMTP_HOST`、`SMTP_FROM_EMAIL`
  - `node scripts/auth-delivery-smoke.mjs --mode sms --env-file ops/deploy/env-files/staging.env --dry-run`
    - 结果：失败；脚本成功识别出 staging env 缺 `ALIYUN_SMS_SIGN_NAME`、`ALIYUN_SMS_TEMPLATE_CODE`
  - `pnpm exec vitest run src/backend/services/__tests__/auth-delivery.test.ts src/backend/services/__tests__/auth-service.test.ts src/backend/routes/__tests__/auth-api.test.ts src/backend/services/__tests__/admin-user-access-service.test.ts`
    - 结果：通过；`4` 个 test files，`28` 个 tests 全部通过
  - `pnpm exec tsc --noEmit`
    - 结果：通过
  - `pnpm lint`
    - 结果：通过
  - `node scripts/auth-delivery-smoke.mjs --mode smtp --env-file .env.local --smtp-verify-only`
    - 结果：通过；本地开发环境里的 SMTP 参数组合可以真实握手
  - `node scripts/auth-delivery-smoke.mjs --mode smtp --env-file ops/deploy/env-files/staging.env --smtp-verify-only`
    - 结果：首次因缺 `SMTP_HOST` / `SMTP_FROM_EMAIL` 失败；补齐后继续失败并进入 `535 Authentication failure`
  - `node scripts/auth-delivery-smoke.mjs --mode sms --env-file ops/deploy/env-files/staging.env --dry-run`
    - 结果：补齐 `ALIYUN_SMS_SIGN_NAME` / `ALIYUN_SMS_TEMPLATE_CODE` 后通过
  - `SMTP_USER='<local-working-user>' SMTP_PASS='<local-working-pass>' node scripts/auth-delivery-smoke.mjs --mode smtp --env-file ops/deploy/env-files/staging.env --smtp-verify-only`
    - 结果：通过
    - 备注：说明 staging 剩余问题收敛为 `talkshow-stag/smtp_user` / `talkshow-stag/smtp_pass` secret drift，而不是 host/port/TLS 或业务代码问题

## Not Run

- `pnpm test` 全量测试未跑；本轮只跑了 auth / redirect / environment 相关验证
- 真库 migration apply 未执行；按任务约束，本轮只提交 SSOT、migration 文件与 context refresh
