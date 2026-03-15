# 05 Pitfalls — architecture-decomposition-eight-priority-files

## Do-not-repeat summary
- Keep façade-level class methods alive when tests or runtime seams patch/spyon instance methods.
  - `ConversationClock` looked “cleaner” when it called the extracted module functions directly, but that silently broke tests and broadcast-triggered scheduling because the instance seam disappeared.
- When moving an LLM gateway call across files, update `src/backend/llm/callsite-inventory.ts` in the same change.
  - The inventory test validates semantic evidence patterns against the source file contents, so a refactor can break it without touching behavior.
- Shadow-review evidence windows must align with the shadow runtime window, not the operator action time.
  - Starting manual review after the agent has already been in shadow mode should not erase the evidence window.
- Fast-refresh lint warnings are easiest to avoid when helper renderers stay in pure component files.
  - If a `.tsx` file exports both components and plain helper functions, `react-refresh/only-export-components` will warn.

## Historical notes
- `AdminPanel.test.tsx` and some other UI tests spend noticeable time in import/environment setup before executing assertions. That is expected in this repo and should not be mistaken for a deadlock by itself.
- `src/backend/routes/__tests__/dev-prompts-render.test.ts` currently stalls in collection/setup when run standalone. This is a repo-level blocker, but it is not required to finish the 8-file decomposition itself.
