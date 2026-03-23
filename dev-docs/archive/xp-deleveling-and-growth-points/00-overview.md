# 00 Overview — xp-deleveling-and-growth-points (T-059)

## Status
- State: done
- Next step: 无；本包已闭环并归档。Mobile 运行态 smoke 留待环境就绪后单独验证。

## Goal
构建稳定、单义的 XP 体系：
- XP 保留无上限累计；
- XP 只负责产出成长点数；
- 成长点直接并入 Stats 点池；

## Non-goals
- 第一阶段不做 XP earning 数值重平衡。
- 第一阶段不做 relation capacity 人格化。
- 第一阶段不改 achievements / stage tier 产品语义。
- 第一阶段不引入第二套独立成长点钱包。

## Outcome Snapshot
- XP API 与账本改为独立 XP 语义。
- 不再存在 level 相关门槛或展示。
- Stats 点数按 `floor(xp / 50)` 稳定同步。
- 旧 level/milestone 记录迁出主 XP 账本。
- Web 成长界面切到 `XP + growth points`。
