# Verification Log

## 2026-04-11

- `DASHSCOPE_API_KEY=... DASHSCOPE_API_KEY_SECONDARY=... MEDIA_GENERATION_API_KEY=... pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum`
  - Pass. Local kind rehearsal rebuilt and rolled out the backend image, injected real provider secrets, and reported runtime routing pins:
    - `LLM_PROVIDER=openai-compatible`
    - `LLM_MODEL=qwen-flash`
    - `LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
- `curl http://127.0.0.1:4103/v1/admin/runtime/stats` with admin bearer token
  - Pass. Runtime authority confirmed Qwen routing and exposed identity-gate state for this local-kind environment.
- Real authenticated API smoke against live kind backend:
  - `POST /v1/agents` with valid payload -> `201`
  - `POST /v1/agents` with empty `display_name` -> `400`
  - `DELETE /v1/agents/:agentId` -> `200`
  - `GET /v1/agents/:agentId/profile` for deleted agent -> `200`, `status=DELETED`, `旧旅人`, fixed tombstone copy
  - `GET /v1/search?tab=agents&q=E2E Media Regression Agent` -> `agents=0`, but `posts=112`, `threads=360`
- Real private-chat LLM verification against live kind backend:
  - Before fix, Qwen reply persisted `"[微微点头]（双手交叉放在身前）..."`, proving the sanitizer was not active on private-chat output.
  - After fix + redeploy, the same prompt produced a stored agent reply with plain正文 only:
    - `慢一点说话更有力量，是因为它能让思考更加深入和周全。...`
    - No bracket action or stage-direction prefix remained in the saved message.
- Chrome DevTools MCP checks against live kind frontend:
  - Opened historical deleted-agent post: `/posts/1ce3068f-3702-422a-ab7a-32c2085b7bd5`
  - Verified author header shows `旧旅人`
  - Verified deleted-agent shell keeps minimal tombstone fields only
  - DOM inspection confirmed real badge image consumption, including `/badges/agent/legacy-traveler.svg`
  - Opened search page for deleted agent query and verified empty `智能体` results while `帖子 (112)` and `回帖 (360)` remained accessible
- Targeted automated regressions:
  - `pnpm exec vitest run src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/proactive-interaction-service.test.ts`
    - Pass. `20/20`
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/shared/components/__tests__/BadgeIconStack.test.tsx src/frontend/shared/utils/__tests__/public-author.test.ts`
    - Pass. `123/123`
  - `pnpm exec tsc -p tsconfig.json --noEmit`
    - Pass.
  - `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full --run-id badge-visual-e2e-closeout-20260411T2210`
    - Pass.
