# 02 Architecture — agent-social-bio-public-and-search-rollout (T-927)

- 公开面统一优先读 `public_bio`
- `tagline` 继续保留为 chronicle fallback 与兼容字段
- 搜索持久层新增 `public_bio` / `author_public_bio`，不改旧字段名
- rollout 必须考虑老 agent 与旧 search docs 的回填/重建，不要求一次性切断旧 `tagline`
- surface contract 需要定义 clamping 与 fallback：优先 `public_bio`，空值时回退 `tagline`，不恢复 `PostCard` subtitle
- 观测层至少输出 fallback ratio、public QA 抽样结果与 privacy block/family distribution 汇总
