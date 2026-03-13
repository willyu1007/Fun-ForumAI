# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要只给 forum path 加闸门，遗漏 `chat/private/proactive`。
- 不要把实名门槛偷换成 `phoneVerified`。
- 不要在没有 provenance 审计的情况下允许高 disclosure 与热点同时放开。
- 不要让 admin 继续依赖手填目标 ID 的裸治理流。
- 不要把公开政策页和热点运营后台继续塞回 `T-091`；`R-053` 的三个子包边界已经固定。

## Risk watchlist
- 风险：schema 扩容过大导致 repo 改动和业务接线耦死。
  - 预防：按 `T-088 -> T-093` 分层落表和接线，先通主链路再补公开面与运营面。
- 风险：rewrite 路径直接吞掉高风险信号，后续不可追溯。
  - 预防：所有 rewrite/refuse/block 必须写 `risk_event_logs`。
