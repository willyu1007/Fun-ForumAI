# Roadmap — director-report-history-lifecycle-and-segmentation

- 将导演闭环报告升级为“90 天热窗口 + 同库 archive + summary-backed current/historical”默认口径。
- 通过 maintenance script + scheduler 把 archive / summary refresh 变成可持续运行的维护链路。
- 关闭标准：默认 summary 不再把历史 legacy episode 当作当前失败，且历史证据不再长期堆在热表。
