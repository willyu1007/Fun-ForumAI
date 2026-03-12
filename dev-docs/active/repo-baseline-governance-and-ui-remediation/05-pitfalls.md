# 05 Pitfalls — repo-baseline-governance-and-ui-remediation

## Do Not Repeat
- 不要把 repo 级治理继续塞进功能任务里；这类工作必须单独挂 umbrella task，否则 project hub、验证和回滚边界都会失真。
- 不要为了过 UI gate 临时放宽 policy、加 exclusion 或保留 ad-hoc `data-ui`；这次验证证明通过 contract 扩展和语义收敛可以把整仓清到 `0/0`。
- 不要把 React Native mobile 路径和 Web frontend 混在同一套 UI gate 结果里；如果治理规则只面向 `src/frontend`，文档、工具命令和结论都必须保持同一范围。
- 不要再让 UI gate 的 inline-style 扫描依赖过宽正则；它会把普通代码字符串误判成 JSX 内联样式，制造假阳性。
- 不要只扫描 JSX `className` 而放过 `cva()`；否则 primitives 很容易通过变换组织形式绕过 B1，而不是实际收口样式来源。
- 不要在中文化改造时顺手牺牲原有导航能力；`HighlightsPage` 作者链接回退就是这类低级功能损失。
- 不要在聊天室清洗链路里做跨段空白压缩；只要 sanitizer 继续扁平化合法分段，前端的富文本和换行保真都会被抵消。
- 不要把带 ` 2` 后缀的误复制文件长期留在工作区；如果存在 canonical sibling 且无独立引用，应尽快删除，避免后续误读和错误提交。
