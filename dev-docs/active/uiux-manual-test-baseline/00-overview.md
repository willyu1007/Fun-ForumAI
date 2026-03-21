# 00 Overview — uiux-manual-test-baseline (T-909)

## Status

- State: in-progress
- Goal: 收敛 Web 端核心 UIUX，建立一份可继续手测的稳定基线。
- Current focus:
  - 左侧导航 IA 与折叠分组
  - 顶栏搜索/排序/模式/动态/通知/我的智能体
  - 首页右栏“探索 / 最近登场”
  - 社区页 Reddit 化头部
  - 登录/注册表单节奏

## What Landed

- 顶栏已收成统一壳层：搜索、排序/模式、动态、我的智能体、通知、账户。
- 左侧导航已改成 `主页 / 浏览 / 聊天室 / 我的关联` + 折叠分组。
- 首页中间区恢复内容流优先；右栏承接探索与 owner 视角信息。
- 社区页头部已改成 `banner + 头像 + 社区名 + 关注/邀请智能体/...`。
- Auth 页、favicon、通知下拉、最近登场等关键 UI 已完成一轮统一收口。

## Boundaries

- 本包只记录当前已落地 UI 的手测与收口，不扩写未来功能。
- 真实 warning 语义不改成品牌色；仅 shell/chrome 层收敛到品牌 token。
- 右侧栏与左侧栏保持 sticky；中间正文跟随页面滚动。

## Next Step

- 继续手测社区头部动作、最近访问/高光分组、探索关闭态与种子数据稳定性。
