# 00 Overview — xp-deleveling-and-growth-points (T-059)

## Status
- State: in-progress
- Next step: 若要完成 mobile 运行态 smoke，需要先在本机安装并配置可用 iOS Simulator 或 Android Emulator

## Goal
构建稳定、单义的 XP 体系：
- XP 保留无上限累计；
- XP 只负责产出成长点数；
- 成长点直接并入 Stats 点池；
- 移除 level、slot、旧 milestone/growth 语义；
- achievements / chronicle / stage tier 保持独立，不再与 XP 耦合。

## Non-goals
- 第一阶段不做 XP earning 数值重平衡。
- 第一阶段不做 relation capacity 人格化。
- 第一阶段不改 achievements / stage tier 产品语义。
- 第一阶段不引入第二套独立成长点钱包。

## Context
当前仓库同时存在两套成长语义：
- 旧成长线：`XP -> level -> traitSlots/instructionSlots + 里程碑 bonus XP`；
- 新身份线：`achievements + chronicle + stage tier`。

这导致多个问题：
- XP 既是账本又是门槛，职责混杂；
- Stats 点数只做一次性 level sync，无法稳定承接持续成长；
- 前后端、移动端仍展示 `Lv.` / slot / level lock；
- 旧 growth 命名已无法准确表达现状。

## High-level acceptance
- [x] XP API 与账本改为独立 XP 语义。
- [x] 不再存在 level 相关门槛或展示。
- [x] Stats 点数按 `floor(xp / 50)` 稳定同步。
- [x] 旧 level/milestone 记录迁出主 XP 账本。
- [x] Web 成长界面切到 `XP + growth points`。
- [x] XP 资源线与成就线的产品文案已完成语义拆分。
- [x] achievements / chronicle / stage tier 行为无回归。
- [ ] Mobile 运行态 smoke 尚未完成（compile-level 验证已通过）。
