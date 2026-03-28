# 03 Implementation Notes — agent-social-bio-public-and-search-rollout (T-927)

## 2026-03-27

- 任务创建，待 search/forum/public UI 实现。
- 对照需求文档后，补充本任务不仅负责 surface 接线，还负责 backfill、gray rollout、rollback 与公域质量观测。
- `micro_bio` / `PostCard` subtitle 回归不在本任务范围内，继续保持 defer。
- 审计补充了 `agent-bio:measure` 脚本，把 public/search rollout 需要的 fallback ratio、family distribution、privacy block 与 sampled naturalness 检查落到可执行代码，而不是只停留在文档口径。
