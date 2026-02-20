<!-- INIT:INIT-BOARD:LLM-TEMPLATE -->
<!--
LLM rules:
- Render this file in the user-confirmed language stored at: init/_work/.init-state.json -> llm.language
- Keep the top sections concise and one-screen readable.
- Do not rely on chat history; derive stage/progress from init state and the machine snapshot below.
- The pipeline updates ONLY the machine snapshot block between the two marker lines shown below.
- Never edit or remove anything inside the machine snapshot block (LLM-owned layout is outside the block).
-->

# INIT-BOARD（初始化看板）

> 阶段状态看板。需求讨论和输入摘要在 `init/START-HERE.md`。

## Focus now
- 初始化已完成（stage=complete），进入 post-init 收尾决策。

## Next actions (human/LLM)
1. 你决定是否执行 `update-root-docs --apply`。
2. 你决定是否执行 `cleanup-init --apply --i-understand --archive`。
3. 我按你的选择完成收尾并给出最终状态摘要。

## Key paths
- `init/START-HERE.md`
- `init/_work/stage-a-docs/`
- `init/_work/project-blueprint.json`
- `init/_work/.init-state.json`

<!-- INIT-BOARD:MACHINE_SNAPSHOT:START -->
## Machine snapshot (pipeline)

- stage: complete
- pipelineLanguage: zh
- llm.language: zh-CN
- stateUpdatedAt: 2026-02-20T14:14:27.941Z
- lastExitCode: 0

- stageA: mustAsk 8/8; docs 4/4; validated yes; approved yes
- stageB: drafted yes; validated yes; packsReviewed yes; approved yes
- stageC: wrappersSynced yes; skillRetentionReviewed yes; approved yes

### Next (suggested)
- Migrate glossary: transfer terms from `init/_work/stage-a-docs/domain-glossary.md` to `docs/context/glossary.json`, then run `ctl-context touch`.
- Initialization complete. Optional: run `cleanup-init --apply --i-understand` to remove init/.

<!-- INIT-BOARD:MACHINE_SNAPSHOT:END -->
