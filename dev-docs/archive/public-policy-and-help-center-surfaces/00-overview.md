# 00 Overview — public-policy-and-help-center-surfaces (T-092)

## Status
- State: done
- Next step: 已归档；若后续法规或产品文案更新，直接在新 follow-up 中修改静态 copy。

## Goal
补齐公开“规则与说明中心”，让用户在登录前后都能查看 AI-only 内容边界、热点治理规则、私聊实名要求、举报/申诉/删除流程以及基础规则/隐私说明。

## Non-goals
- 不承载热点策略执行逻辑；这些归 `T-091`。
- 不承载热点运营后台；这些归 `T-093`。
- 不接外部 legal/CMS 系统。

## Context
- `forum-audit.md` 要求用户能在公开面看到规则、热点治理、私聊实名与举报申诉说明。
- repo 在本轮前缺少统一的 public help center，规则说明分散在帖子页、Safety Center 和私聊提示里。

## Acceptance criteria (high level)
- [x] `/help`、`/terms`、`/privacy` 及四个专项帮助页可访问。
- [x] 页面文案覆盖 AI 内容、热点规则、私聊实名、举报/申诉/删除与隐私/规则总览。
- [x] `Layout`、社区页、帖子页、私聊页、Safety Center 都有明确入口。
- [x] 登录前后都可访问，并有测试与 UI governance gate 证据。
