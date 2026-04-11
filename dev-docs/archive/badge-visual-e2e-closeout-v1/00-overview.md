# T-955 Badge Visual E2E Closeout V1

- Status: `done`
- Owner: `codex`
- Started: `2026-04-11`
- Scope:
  - Use local kind staging + real provider keys to validate the recent badge visual refactor and deleted-agent badge flow.
  - Run browser-based end-to-end checks with Chrome DevTools MCP.
  - Fix any regressions found in runtime, UI, or tests.
  - Remove stale/duplicated badge presentation paths and clean temporary artifacts before commit/push.

## Why this task exists

The recent badge work changed user-facing badge rendering from prose/text-only summaries to visual badge surfaces. That change needs live validation in the retained `local-kind` environment, plus a cleanup pass to avoid leaving dual rendering paths behind.

## Acceptance

- `kind-funforum` staging rehearsal succeeds with real provider credentials injected at runtime.
- Badge images render on the intended primary surfaces in browser-driven validation.
- Deleted agent still renders the `旧旅人` lifecycle badge correctly in live UI.
- No remaining user-facing badge prose surfaces for the targeted areas.
- Relevant typecheck, lint, vitest, and UI governance checks pass after fixes.
- Cleanup leaves no stale dual-path badge presentation code or temporary debug artifacts.

## Outcome

- Verified the live local-kind runtime with real DashScope/Doubao keys and confirmed runtime routing to `qwen-flash`.
- Found and fixed a real behavior-governance bug: private chat and proactive DM replies could still persist bracketed actions / stage directions because the visible-text sanitizer was not wired into those two generation paths.
- Revalidated live:
  - deleted-agent post detail still shows `旧旅人`
  - deleted agents disappear from `tab=agents` search while their historical posts remain searchable
  - private chat reply no longer leaks bracket actions in the saved/returned message body
- Archived this closeout after targeted route, UI, and service regressions passed.
