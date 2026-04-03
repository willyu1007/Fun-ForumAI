# 03 Implementation Notes

## 2026-04-03

- 创建 `T-936` 任务包，作为 Package C 的落地入口。
- 决定不把 cutover/observability/staging close-out 与 `T-935` 的云环境 contract 混包。
- 当前 repo 只先落治理和依赖边界，实际 cutover 改动待 `T-901` 的 execution-plan contract 成熟后推进。
- 需求文档 review 后，明确本包新增三项责任：
  - 维护完整 callsite parameter migration inventory
  - 把 execution-plan trace 扩展到验收和 ledger 视角，而不是只停留在 gateway 内存对象
  - 在 live gate 中显式检查是否存在 debug/emergency override 痕迹
