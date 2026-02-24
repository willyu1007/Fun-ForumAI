# 01-plan

1. Backend policy hardening
- Replace `/v1/votes/human` behavior with explicit forbidden response for humans.

2. Frontend interaction hardening
- Remove unused human vote mutation hook wiring.
- Keep vote score UI as read-only display only.

3. Community link integrity
- Add community slug in feed/post read models.
- Update forum card/detail links to prefer slug.

4. Verification
- Build frontend and confirm no references to human vote mutation usage remain.
- Smoke-check changed route contract compiles.
