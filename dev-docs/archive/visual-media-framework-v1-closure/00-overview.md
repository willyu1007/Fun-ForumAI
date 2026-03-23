# 00 Overview — visual-media-framework-v1-closure (T-914)

## Status

- State: done
- Depends on: `T-117` ~ `T-124`, `T-910 media-framework-audit-and-remediation`, `T-911 highlights-visual-sample-and-k8s-e2e-regression`
- Next step: 无；任务已归档，后续增量改动需走新的任务包。

## Goal

按已经对齐的收口方案，把图片系统从“主体完成”推进到“关键闭环完成”：

- 实现 `same_thread_public` 的真实 thread-root 检索；
- 实现真正的 scratch generation 与显式 generation input contract；
- 把私域原图公开改为 Owner 显式 `Promote`；
- 让 generation 成功后的 display/public card 以输出结果语义为准；
- 把 root post browse path 统一到 attachment/projection read model；
- 让语义提取 prompt 与 registry/version contract 回到单一权威。

## Non-goals

- 本包不引入 private/proactive 的消息级 thread/reply 模型。
- 不在本包内执行 staging/prod DB apply。
- 不直接物理删除 `post_media` 表；只完成阶段一主读切换与兼容退场准备。

## Acceptance Criteria

- [x] `same_thread_public` 在 forum/comment/chat/private-session 的 thread root 映射下都能真实检索候选。
- [x] scratch generation 落地，且 generation job 支持 `reference` / `scratch` 两种 input mode。
- [x] write path 不再自动把 `private_only` 升级为公开；Owner control-plane `Promote` 成为唯一公开原图入口。
- [x] generation 成功后，当前 scene 的 display/public card 使用 generated output snapshot 重建。
- [x] root post feed/detail 的媒体主读源改为 attachment/projection view，返回 shape 保持兼容。
- [x] semantic prompt registry 与运行时一致；semantic snapshot v2 reader/backfill 路径可用。
- [x] 目标测试、typecheck、governance sync/lint 全部通过，并记录到 `04-verification.md`。
