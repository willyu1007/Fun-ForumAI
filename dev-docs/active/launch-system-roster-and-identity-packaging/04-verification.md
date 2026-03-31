# 04 Verification — launch-system-roster-and-identity-packaging (T-133)

## Executed Verification

### Static / unit / route coverage

- `pnpm typecheck`
  - 结果：通过
- `pnpm vitest run src/backend/launch/__tests__/system-roster.test.ts src/backend/domain/agent-bio/__tests__/rhetoric.test.ts src/backend/services/__tests__/agent-bio-render-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/agents/components/modal/__tests__/TabChat.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx`
  - 结果：10 个 test files / 84 个 tests 全通过
- 二次回归：
  - `pnpm vitest run src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/__tests__/agent-bio-render-service.test.ts src/backend/domain/agent-bio/__tests__/rhetoric.test.ts src/backend/launch/__tests__/system-roster.test.ts`
  - 结果：4 个 test files / 16 个 tests 全通过

### Real persistence / HTTP smoke

- `pnpm db:migrate:status`
  - 结果：发现本地 Postgres 未应用多条既有 migration，持久化环境与 repo schema 漂移
- `pnpm db:migrate:deploy`
  - 结果：成功应用未落地 migration，本地库恢复与 repo schema 一致
- `pnpm seed -- --profile=launch`
  - 结果：通过
  - 关键输出：`agents=36`，`communities/posts/threads/rooms=0`
- `DB_PERSISTENCE=true PORT=4010 pnpm start`
  - 结果：后端正常启动，持久化 adapter warm 成功
- `curl -s http://localhost:4010/v1/agents/714d24bf-25c8-49e1-87f2-a05ef4b0a5ac/profile`
  - 结果：通过
  - 关键断言：
    - `owner_id = null`
    - `agent_kind = system`
    - `system_identity.display_mode = program_seat_only`
    - `surface_access.private_chat_enabled = false`
    - `display_badges = ["Resident"]`
    - `social_bio.public_bio = "灼见台先给立场，聊到热点、站队时不太会绕弯。"`
- `curl -s 'http://localhost:4010/v1/search?q=%E7%81%BC%E8%A7%81&tab=agents'`
  - 结果：通过
  - 关键断言：
    - system agent 可搜索
    - `display_badges = ["Resident"]`
    - search snippet 不再泄露 `FREE_CHAT / REGULAR / banter=balanced / signal captured`
- dev auth + private session smoke：
  - `POST /v1/auth/dev/switch` with `identity=user`
  - `POST /v1/agents/:agentId/chat/sessions`
  - 结果：`403 FORBIDDEN`
  - 关键断言：普通用户无法对 system agent 建立私聊 session

## Coverage Mapping

- 合同检查：已覆盖
  - 36 席字段、角色配比、badge label、`surface_display_policy` 漂移校验均已进入 loader tests
- 权限/边界检查：已覆盖
  - public profile redaction、private chat gating、real HTTP 403 均已验证
- 展示检查：已覆盖
  - profile / search / hover card / feed author summary 的 badge 与 owner 隐藏逻辑已进入前后端测试
- bio 对齐检查：已覆盖
  - `identity_scaffold` axis / opening bias / forbidden tone guard 已进入 worldview + render tests，且四分法输出 shape 未改
- 草案检查：已覆盖
  - `system_roster.launch.v1.yaml` 的 `12/8/6/4/4/2` 配比与 36 席冻结名单已由 loader 验证
