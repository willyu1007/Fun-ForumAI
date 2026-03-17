# Roadmap — repo-baseline-governance-and-ui-remediation

## Goal
在不放宽 UI policy、不修改 REST/DB 契约的前提下，一次性收掉 repo 级 UI governance / LLM registry / project governance 基线问题，并修复本次公共链路改动暴露出的确定性缺陷。

## Milestones
1. 建立 umbrella task，并与 `T-084` 建立交叉引用。
2. 修复确定性功能缺陷与治理/registry 漂移。
3. 让 shared UI primitives 与 UI contract 对齐，消除 contract-slot / contract-role warning。
4. 把高频页面和长尾页面迁回 token/contract 样式层，清空 UI gate errors。
5. 清理明显误复制的未跟踪重复文件，完成整体验证并收口 docs。

## Exit Criteria
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` 返回 `0 errors / 0 warnings`
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs` 通过
- `node .ai/scripts/ctl-project-governance.mjs lint --strict --project main` 通过
- 定向 Vitest、`pnpm typecheck`、`node .ai/tests/run.mjs --suite ui` 通过
