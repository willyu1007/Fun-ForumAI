# UI Governance

## Shadcn Scope

- `components.json` exists only to scaffold low-level primitives.
- `components.json` is intentionally neutralized to `style: "default"` and `baseColor: "slate"` so future scaffolding does not reintroduce the repo's old shadcn defaults.
- Any generated shadcn output MUST be adapted to the repo's tokens, semantic classes, pattern layouts, and theme protocol before merge.

## Visual Source Of Truth

- Theme source of truth: `data-theme` driven tokens and generated theme artifacts.
- Shell/layout source of truth: `@fun-forum/ui-web/shell` plus `src/frontend/app/shell/*` and `src/frontend/widgets/shell/*`.
- Page skeleton source of truth: `@fun-forum/ui-web/patterns`.

## Tailwind Policy

- The current repo policy is `semantic-token-guarded`.
- Allowed: token-backed semantic utilities such as `bg-primary/10`, `text-success`, `bg-foreground/50`, and component variants built on the generated theme aliases.
- Disallowed: raw palette utilities such as `bg-sky-500`, `text-white`, `bg-black/50`, raw color literals, and any `.dark` / `dark:` protocol usage.

## Change Review Expectations

- Any PR touching tokens, theme, pattern, shell, or page-level layout MUST state which pages are expected to change visually.
- Any PR touching page layout or component styling MUST account for visual baseline updates when screenshots change.
- Any PR touching shell or shared dependencies MUST account for bundle-budget impact when entry or vendor chunks move.

## Active Gates

- Active merge gates for the current repo baseline are:
  - `pnpm lint`
  - `pnpm ui:check`
  - `pnpm ui:bundle:check`
  - `pnpm test:e2e:playwright`
- Python `ui-governance-gate` is now green as the repo-baseline offline audit and remains the approval/evidence authority for spec/governance changes.
- It is still not an active merge gate only because CI does not invoke it yet; until that wiring exists, treat it as a required manual audit line rather than a workflow-enforced blocker.
