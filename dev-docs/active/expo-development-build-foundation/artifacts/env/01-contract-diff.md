# Contract Diff — expo-development-build-foundation

## Added variables
- `EXPO_PUBLIC_API_BASE_URL`
  - type: `string`
  - required: `false`
  - purpose: 移动端 API base override
- `EXPO_EAS_PROJECT_ID`
  - type: `string`
  - required: `false`
  - purpose: EAS metadata 注入与 dev build 操作前置配置

## Generated artifacts refreshed
- `env/.env.example`
- `docs/env.md`
- `docs/context/env/contract.json`

## Breaking-change assessment
- None
- 两个变量都是新增 optional key，不改变任何既有变量的 requiredness、type 或默认值。
