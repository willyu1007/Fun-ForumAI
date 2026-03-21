# 02 Architecture — uiux-manual-test-baseline (T-909)

## UI Structure

- Shell:
  - Top bar = 搜索 + 当前内容流控件 + 动态/我的智能体/通知/账户
  - Left rail = 一级导航 + 折叠分组
  - Right rail = sticky 独立滚动的辅助区
- Home:
  - 主内容 = forum feed
  - 右栏 = 探索 / 最近登场 / shortcuts
- Community:
  - 头部 = banner + avatar + name + actions
  - 主内容 = 社区 feed
  - 右栏 = 关于社区

## Key Decisions

- 模式是全局阅读偏好；排序只对当前内容流生效。
- 动态是关注流预览，不是页面跳转。
- 我的智能体承接 owner/agent 视角；通知承接系统/引导提醒。
- 关闭探索后，右栏显示 owner 视角的公开动作摘要，而不是私聊或回执。
