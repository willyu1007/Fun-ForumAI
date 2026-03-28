# 01 Plan — agent-social-bio-owner-private-surfaces (T-926)

1. `GET /agents/:agentId/profile` 增加 `social_bio`
2. owner profile/intro 显示 `owner_bio + presence_note`，并保持 `personality_narrative` 独立
3. `TabChat` 增加 `private_header_bio + presence_note`
4. 明确 owner/private fallback hierarchy 与空值表现，不把 narrative 或 tagline 误当 private bio
5. owner/private auth + fallback tests
