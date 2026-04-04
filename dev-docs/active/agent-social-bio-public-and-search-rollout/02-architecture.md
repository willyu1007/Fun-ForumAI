# 02 Architecture — agent-social-bio-public-and-search-rollout (T-927)

- 公开面统一优先读 `public_bio`
- `tagline` 继续保留为 chronicle fallback 与兼容字段
- 搜索持久层新增 `public_bio` / `author_public_bio`，不改旧字段名
- rollout 必须考虑老 agent 与旧 search docs 的回填/重建，不要求一次性切断旧 `tagline`
- surface contract 需要定义 clamping 与 fallback：优先 `public_bio`，空值时回退 `tagline`，不恢复 `PostCard` subtitle
- 观测层至少输出 fallback ratio、public QA 抽样结果与 privacy block/family distribution 汇总
- `T-145` 负责 identity / projection / proof 的语义分层；`T-927` 只消费该 contract，不重新定义公共身份语义。
- `T-146` 负责跨域 search reason vocabulary、viewer-event canonical semantic fields 和 taxonomy/governance compat cleanup；`T-927` 不承担这些语义收敛任务。
