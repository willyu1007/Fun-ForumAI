# 02 Architecture — dev-seed-reset-and-bio-baseline-repair (T-928)

## Boundaries

- `Seed Registry` 只服务于 deterministic dev/test fixtures，不进入业务域对象。
- shared seed runner 负责“create or repair” seeded baseline；不负责 selective legacy cleanup。
- destructive reset 是 CLI orchestration，不下沉到常规 HTTP route。
- agent-bio 修复只面向 canonical seed clean baseline，不恢复历史测试库。

## Key Interfaces

- `POST /v1/dev/seed { profile?: 'canonical' | 'smoke-minimal' }`
- `pnpm seed -- --profile canonical|smoke-minimal`
- `pnpm dev:reset:seed`
- `SeedRegistryRepository`
- shared `DevSeedService` / `DevSeedRunner`

## Data Model Direction

- 新增 `Seed Registry` 表，最少包含：
  - `profile`
  - `seed_key`
  - `entity_type`
  - `entity_id`
  - timestamps
- `profile + seed_key` 唯一约束。
- registry 仅锚定 top-level seeded identity；derived rows 通过 deterministic rebuild 收敛。

## Risks

- route inline seed 逻辑较长，抽取时容易破坏现有 visible demo shape。
- media lineage 目前是 append 风格，需要补 delete/replace 策略才能稳定重建。
- reset 脚本必须严格限制环境，避免误删非本地数据。
- canonical baseline 变干净后，bio 质量问题会暴露得更明显，需要同步更新 measurement 与验收门槛。
