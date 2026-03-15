# 05 Pitfalls — facade-slimming-and-wrapper-retirement

## Do-not-repeat summary
- Do not delete wrappers solely because tests pass once; first confirm they are not still carrying runtime reentry or telemetry seams.
- Do not thin page shells by pushing complexity back into a new giant controller or giant section file.

## Inventory drift after callsite moves
- Symptom: `callsite-inventory.test.ts` failed even though the moved implementation still used the correct prompt family and gateway surface.
- Root cause: the semantic inventory entry tracked the original façade file instead of the new sibling module that now owns the actual LLM dispatch.
- Fix:
  - update `source_file`
  - update evidence patterns so they match the new module form rather than the old class form
- Prevention: treat callsite inventory as part of any LLM-related extraction. If the code move changes where `promptRef`, `intent`, or gateway dispatch live, update the inventory in the same patch.

## Thin façade, not hidden monolith
- A façade is only “thin” if private workflow logic leaves with the extraction.
- If the entry file still owns lifecycle bookkeeping, evidence collection, parsing branches, and helper searches, the file is still a monolith with imports.
- Prevention: after each extraction, measure the remaining entry file and confirm the private helpers are gone, not just relocated lower in the same file.

## Frontend slicing must narrow props
- Splitting a page into more files is not enough if every child still receives the full controller bag.
- Prevention: each child tab or card should receive the smallest stable slice that matches its domain.
