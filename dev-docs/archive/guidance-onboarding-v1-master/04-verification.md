# 04 Verification

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` — pass
- `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-onboarding-v1-master"` — pass
- `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-platform-foundation"` — pass
- `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-web-core-experience"` — pass

## Coverage
- Governance checklist
- Execution log
