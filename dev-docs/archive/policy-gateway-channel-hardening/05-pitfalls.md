# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要在 createSession 只拦创建，却允许未实名继续发消息。
- 不要让 rewrite 路径绕过 risk event 记录。
- 不要对大陆 public path 继续容忍宽松 fallback。
- 不要把 `message` target 只注册在治理枚举里却不真正回写 `visibility/state`。
