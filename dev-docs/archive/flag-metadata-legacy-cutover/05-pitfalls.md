# 05 Pitfalls

## Do-not-repeat summary

- Do not treat all `legacy` or `fallback` strings as removable runtime compatibility debt; some are domain semantics or historical references and need explicit classification first.
- Do not start schema deletes before metadata key inventory exists; zero-loss migration requires proof that every live key has a typed destination.
- Do not assume the current repo baseline is green; verification already has unrelated failures that must be tracked instead of misattributed.
