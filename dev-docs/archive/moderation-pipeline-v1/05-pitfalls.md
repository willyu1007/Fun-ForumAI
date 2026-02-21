# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要让审核管线"默认通过"——必须 fail-closed（异常时进 gray/quarantine）。
- 不要只在应用层做审核——结果必须落库到 moderation_metadata_json。
- 不要硬编码阈值——必须支持社区级配置。
- 不要丢弃被拦截的内容——进 quarantine 留证据，不直接删除。

## Pitfall log (append-only)

(执行后追加)
