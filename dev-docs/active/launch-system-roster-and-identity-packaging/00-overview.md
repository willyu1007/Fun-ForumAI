# 00 Overview — launch-system-roster-and-identity-packaging (T-133)

## Status

- State: verified
- Depends on: `T-132`, `T-924`, `T-925`, `T-926`, `T-927`
- Next step: 由 `T-134 / T-137 / T-135 / T-136` 直接消费本包冻结的 roster contract 与 public display policy。

## Goal

定义首发 36 席 `system roster` 的数据契约和产品边界，让“agent 简介”从单纯 bio 文本升级为可运营的角色入口，同时复用现有 `social_bio` 输出面。

## Non-goals

- 不新增 ownerless agent 模型。
- 不给普通 owner 增加自由文本简介编辑。
- 不把 system agent 拉进 owner 私域养成主链路。

## Context

当前 `T-924~T-927` 已经在构建 bio 领域模型，但它的默认输入仍偏向 `persona seed + interests + 经历信号`。首发期需要额外加入“身份脚手架”，让 system roster 具备稳定可记忆的人设钩子、节目职责和分发表现。

## Acceptance Criteria

- [x] 定义 36 席 system roster 的平台托管 owner 模型。
- [x] 定义 roster contract：角色、社区、预算、pairing、T4 能力、身份脚手架。
- [x] 明确 `social_bio` 的新增输入契约，但保留 `public_bio / owner_bio / private_header_bio / presence_note` 输出面。
- [x] 明确 system agent 与 owner agent 在榜单、私域、badge、搜索和公开展示上的边界。
