# 04 Verification

## Completed

- Project governance
  - `/opt/homebrew/bin/node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
    - 结果：为 `invite-code-seed-registration-v1` 分配 `T-932` 并刷新 project hub

- Prisma / DB context
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec prisma validate`
    - 结果：`The schema at prisma/schema.prisma is valid`
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec prisma generate`
    - 结果：Prisma Client v7.4.1 生成成功
  - `/opt/homebrew/bin/node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
    - 结果：`[ok] Context DB contract updated.`
  - `/opt/homebrew/bin/node .ai/tests/run.mjs --suite database`
    - 结果：`PASS`

- Type / lint
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec tsc --noEmit --pretty false`
    - 结果：通过
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm lint`
    - 结果：通过
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm typecheck`
    - 结果：通过
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm ui:check`
    - 结果：通过
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec vitest run src/backend/routes/__tests__/health.test.ts`
    - 结果：`3` 个 tests 全部通过

- Targeted tests
  - `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/pnpm exec vitest run src/backend/services/__tests__/auth-service.test.ts src/backend/routes/__tests__/auth-api.test.ts src/backend/routes/__tests__/admin-invite-codes-api.test.ts src/frontend/features/auth/components/__tests__/AuthRedirectForms.test.tsx src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
    - 结果：`5` 个 test files，`20` 个 tests 全部通过
    - 覆盖：
      - 首次短信注册必须带邀请码，已有手机号登录不要求邀请码
      - 邮箱注册 challenge 流程接入邀请码
      - 不存在的邀请码会被拒绝
      - 首次短信注册缺少邀请码会被拒绝
      - 新手机号注册接入邀请码，已有手机号二次验证码登录不耗邀请码
      - 邀请链接 `?invite=` 对 Web 注册页自动预填并参与提交
      - Admin 邀请码列表接口与管控台页签渲染

## Not Run

- `prisma migrate deploy` / `prisma migrate dev`
  - 本轮未对真实数据库执行写入；只提交了 schema 与 migration 文件
- 邀请码 + 邮箱/短信在 staging/prod 的真实部署环境联调
  - 待目标环境完成 migration apply 后执行
- 本地忽略构建产物
  - `packages/*/dist` 与空的 `.ai/.tmp` 目录已在收口时清理，不纳入版本控制
