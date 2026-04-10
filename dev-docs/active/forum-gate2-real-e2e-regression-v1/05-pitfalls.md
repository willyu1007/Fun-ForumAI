# 05 Pitfalls

## Do-not-repeat summary

- Do not diagnose Gate 2 UI from a single post without checking `participation-contract` first. In canonical local-kind seed data, many visually rich posts are `audience_sidecar`, so “no `回应这里` button” can be correct behavior.
- The audience composer placeholder uses the typographic ellipsis `…`, not three ASCII dots. Browser scripts that search for `留下你的观众留言...` will false-negative.
- `scripts/k8s-local-staging.mjs` previously mixed “read from configurable env name” with “write back from hardcoded `DASHSCOPE_API_KEY`”. Any future secret merge helper must keep read/write sources aligned or rollout verification will be polluted by stale credentials.
- Keep long-lived `kubectl port-forward` sessions explicit. They masked later rollout checks by making port `4100` look busy until manually cleaned up.
