# Roadmap — expo-development-build-foundation (T-060)

## Objective
建立 iOS / Android 共用的 Expo Development Build 交付基线，使移动端从单纯 `expo start` 原型切换到可重复的 dev build 运行方式。

## Macro plan
- 治理与 env contract 对齐
- Expo / EAS 配置落地
- 本地 fallback 脚本与 ignore 策略
- CI scaffold
- 文档、验证与运维说明

## Risks
- 本机缺少 simulator / emulator 工具链
- Android host routing 与 iOS 默认值不一致
- prebuild 生成的 native 目录误入版本库

## Rollback
- 移除新增脚本、EAS 配置与 env 条目
- 保持现有 Expo managed baseline 可继续通过 `expo start` 使用
