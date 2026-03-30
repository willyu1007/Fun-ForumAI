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

## Not Run

- `pnpm test` 全量测试未跑；本轮只跑了 auth / redirect / environment 相关验证
- 真库 migration apply 未执行；按任务约束，本轮只提交 SSOT、migration 文件与 context refresh
