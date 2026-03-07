# Change Intent — expo-development-build-foundation

## Objective
为 `T-060` 增加移动端 dev build 所需的环境契约项，并把它们纳入 repo-env-contract SSOT：
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_EAS_PROJECT_ID`

## Why
- `EXPO_PUBLIC_API_BASE_URL` 需要成为可声明、可文档化的移动端 API base override。
- `EXPO_EAS_PROJECT_ID` 需要成为 EAS development build 的显式输入，而不是隐式约定。

## Risk level
- Low
- 新增变量均为 optional，不破坏现有 backend / web 配置。
