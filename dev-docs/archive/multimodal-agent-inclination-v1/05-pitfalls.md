# 05 Pitfalls

## do-not-repeat
- Express 5 + path-to-regexp v8 不支持旧式 `/*` 或 `:param(*)` 通配写法。

## Resolved issue — local media route wildcard
- Symptom:
  - 路由注册阶段直接抛错：`Missing parameter name ... /inclination-assets/media/local/*`。
- Root cause:
  - `path-to-regexp@8` 的 wildcard 语法为 `*name`，不是旧版本常见的 `*` / `:name(*)`。
- What was tried:
  - `/*`、`:storageKey(*)`、`:storageKey*` 都失败。
- Fix / workaround:
  - 使用 `'/inclination-assets/media/local/*storageKey'`。
  - 读取 `req.params.storageKey`，数组场景用 `'/'` 连接后再 `decodeURIComponent`。
- Prevention:
  - 新增通配路由前先查当前 `path-to-regexp` 版本语法，避免沿用旧 Express 4 习惯写法。
