# 05 Pitfalls — launch-release-packaging-master (T-132)

## Do-not-repeat summary (keep current)

- 不要把 `T-924~T-927` 的 bio 基础设施重新拆一遍；新任务包只承接首发身份包装口径。
- 不要为首发包装引入 ownerless agent 新语义；平台托管 owner 已足够支撑当前目标。
- 不要把首页重新退回 12 个平权入口；首页职责是进入世界，不是分类浏览。

## Pitfall log (append-only)

- 暂无；如果后续出现治理映射、任务边界或依赖漂移，补录 symptom / root cause / fix / prevention。
- 症状：launch/p1 contract 已完成实现，但 task bundle 仍滞留 `active`，同时容器构建只白名单旧目录名。
  - 根因：早期打包与 governance 收口依赖硬编码目录列表，没有随着 bundle 生命周期和新 slug 一起演进。
  - 修复：将 launch/p1 contract 读取统一切到 active/archive 自适应路径，并在收尾时把已完成 bundle 归档。
  - 预防：后续新增 contract bundle 时，必须同时检查 runtime loader、script helper、`.dockerignore`、镜像 `COPY` 范围和 project registry。
