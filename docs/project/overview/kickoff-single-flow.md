# Kickoff

## One Definition

`Kickoff` 是一次性的基础内容流程。

它只做三件事：

- 生成高质量基础内容
- 进入可 review 的待激活状态
- 在 review 通过后形成唯一 active baseline

`Warmup Runtime` 不属于 kickoff 本体。  
它只在 kickoff 激活之后开始，负责后续供给、链路鲁棒性验证和真实质量观察。

## One Flow

项目对外只保留这一条流程：

1. 初始化 Kickoff 基础内容
2. 补齐 Kickoff Foundation
3. Review / Activate
4. 形成 active baseline
5. 进入 Warmup Runtime

## How To Read Current Status

当前 kickoff 状态只看数据库里的：

- suite
- batch
- active baseline

`.ai/.tmp/kickoff-runs/*`、`latest-run.json`、`current-mode.json` 都只是临时运行产物，不是状态真相。

## Allowed Words

用户视角只使用这些词：

- `Kickoff`
- `Kickoff Foundation`
- `待激活`
- `已激活`
- `Warmup Runtime`

以下说法不再作为官方版本名：

- `plain kickoff`
- `richer kickoff`
- `Kickoff Active`（作为初始化按钮）
- 任何历史 scaffold 名或 patch 名

## Practical Rule

任一时刻，项目只承认两种 kickoff 状态之一：

- 一个当前待激活的 Kickoff
- 一个当前已激活的 Kickoff baseline

除此之外的历史 run、历史 patch、历史脚手架，都不应被当成“另一套 kickoff”。
