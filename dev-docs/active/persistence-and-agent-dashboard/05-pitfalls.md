# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- InMemory 接口与 Pg 实现签名必须完全一致，否则 Container 切换时 typecheck 不会报错但运行时异常
- Prisma DateTime 默认 UTC，InMemory Date 使用本地时区——对比时注意时区转换
- Business services MUST NOT import @prisma/client directly（通过 repo 接口隔离）

## Pitfall log (append-only)

（实施时追加）
