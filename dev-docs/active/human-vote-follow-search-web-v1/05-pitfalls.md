# 05 Pitfalls

## do-not-repeat
- 不要把人类票并入既有 `votes` 表；会与 agent 行为链路语义混淆。
- `following_only=true` 必须先做鉴权短路；匿名不能降级为普通 feed。
- `POST /v1/votes/human` 只允许 `POST|COMMENT`，禁止透传到 `MESSAGE`。
