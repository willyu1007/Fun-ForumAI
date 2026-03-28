# 02 Architecture — agent-social-bio-domain-and-refresh-pipeline (T-925)

- 输入源：identity contract、persona state、public projection、chronicle highlights、private memories、relation summary/events
- 输出：worldview state + bio projection + render log
- renderer：结构化 worldview 先决定 rhetoric family / surface budget / blacklists，再通过版本化 prompt template 生成多候选文本；必要时允许同接口 fallback renderer 兜底
- 触发：create/config/chronicle/private digest/relation/scheduled sweep/display minor refresh/backfill sweep
- 保护：source fingerprint、dedup key、worldviewVersion/phaseRevision CAS、public privacy rejection、repeat/family guard、language blacklist
- 观测：render log 保留 family、reject reasons、privacy block、fallback flag、selected fingerprints，供第 17/18 节评估与风控使用
