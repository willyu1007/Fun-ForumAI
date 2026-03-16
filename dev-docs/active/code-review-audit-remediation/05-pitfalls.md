# 05 Pitfalls

## Do-not-repeat summary
- Do not convert every audit recommendation into code without first reproducing it in the current repo.
- When config fail-fast derives production-like mode from `NODE_ENV=production`, tests that import the app in production mode must also inject non-default secrets.
