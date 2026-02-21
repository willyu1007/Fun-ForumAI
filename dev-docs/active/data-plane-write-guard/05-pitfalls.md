# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要只在路由层做 guard——必须三层防护（路由 + 服务 + 存储）。
- 不要使用白名单标记 Data Plane 端点——应使用默认拒绝策略，只白名单 Read/Control Plane。
- 不要把服务密钥硬编码或提交到代码库。

## Pitfall log (append-only)

(执行后追加)
