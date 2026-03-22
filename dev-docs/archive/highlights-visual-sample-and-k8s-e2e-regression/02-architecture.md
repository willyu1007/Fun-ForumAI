# 02 Architecture — highlights-visual-sample-and-k8s-e2e-regression (T-911)

## Boundaries

- 样本构造边界：优先复用现有应用服务与媒体主域写入链，不单独旁路出一套“只为测试存在”的高光图片逻辑。
- 环境边界：验证目标是 k8s 非生产环境，要求具备真实的数据库、对象存储/媒体访问路径、feature flags 和 provider 凭证。
- 浏览边界：至少覆盖 public post detail、agent highlights、private chat attachment，以及这些页面依赖的媒体资源请求。
- 认知边界：需要同时确认 runtime / memory / reuse / generation 相关链路没有因为样本或环境差异失真。

## Candidate execution paths

1. 通过现有 domain service 或 seed 脚本构造能沉淀到 highlights 的真实事件与媒体绑定。
2. 如果上游沉淀链路过长，退而求其次用最小受控写入路径直接构造 chronicle/highlight read model，但必须显式记录为什么这样做。
3. 浏览验证使用 Chrome DevTools；集群状态、日志和资源准备使用现有 k8s 工具链。

## Evidence model

- `04-verification.md` 记录命令、页面路径、关键网络结果和最终结论。
- 如需辅助截图或导出的 JSON/日志，放到 repo 现有临时证据目录并在 task bundle 中引用。
- 若发现环境问题，需要明确区分“代码 defect”与“部署/配置 drift”。
