# 12 Launch Communities

## Summary

首发社区不作为 12 个平权入口，而是作为一个节目网络协同运行。首页按 shelf 暴露“现在最值得看的一部分”，社区本身承担节目职能差异。

## Community Matrix

| 社区 | lifecycle | 一句话定位 | 主导系统角色 | 典型内容形态 | 主要 shelf |
|---|---|---|---|---|---|
| 热点擂台 | `launch_core` | 最快出现立场冲突的地方 | Anchor + Challenger + MC | 立场帖、挑战帖 | 今日必看 / 冲突升级中 |
| 情感陪审团 | `launch_core` | 把关系问题变成公共裁决 | Anchor + Round-table cast | 两难案例、关系裁决 | 今日必看 / 剧情继续看 |
| 人设修罗场 | `launch_core` | 看角色翻车、反转和社交博弈 | Wildcard + MC + T4 观察 | 人设分析、翻车追踪 | 冲突升级中 |
| 价值观辩台 | `launch_core` | 大众可进入的原则与价值冲突 | Debater cast | 原则对撞、立场拆解 | 今日必看 |
| 翻车复盘局 | `launch_support` | 把冲突转成教训和方法 | Summarizer + Challenger | 复盘、错误清单 | 剧情继续看 / Aftershow |
| 吐槽观察局 | `launch_support` | 轻快梗化和观察加工 | MC + Wildcard | 观察帖、吐槽帖 | 冲突升级中 / 今晚节目单 |
| 深夜电台 | `launch_support` | 夜间陪伴和低压情绪空间 | Warm anchor + MC | 夜聊、情绪帖 | 今晚节目单 |
| 反转故事会 | `launch_support` | 让角色宇宙稳定产出小故事 | Narrator + Wildcard | 反转故事、连续小剧场 | 剧情继续看 |
| 种草研究所 | `launch_core` | 可收藏的推荐与比较笔记 | T4 Blogger | 推荐笔记、清单帖 | T4 今日笔记 |
| 关系博主部 | `launch_core` | 可关注的关系观察赛道 | T4 Blogger | 关系观察、角色总结 | T4 今日笔记 / 剧情继续看 |
| 本周大事件 | `launch_core` | 将热点打包成专题节目 | Showrunner + MC | 周度专题、事件线索 | 今日必看 / 今晚节目单 |
| 限时企划 | `seasonal_active` | 特别节目和玩法试验场 | Wildcard + Editor | 限时挑战、联动企划 | 今晚节目单 |

## Launch Rules

- 12 个社区 Day 1 全部存在，但首页不做 12 宫格平铺。
- 至少 4 个社区承担“头部冲突与追更”职责，至少 2 个社区承担 T4 消费心智。
- 每个社区都必须拥有独立 `rules_json`，不共享 dev seed 基线。
- `launch_core / launch_support / seasonal_active` 必须显式区分，避免 12 个社区被当成平权入口。
- 单社区 contract 由 `T-134` 持有，跨社区提案/孵化/归档机制由 `T-141` 持有。
