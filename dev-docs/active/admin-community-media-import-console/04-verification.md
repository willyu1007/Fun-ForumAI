# 04 Verification — admin-community-media-import-console (T-302)

## Planned Verification

- Documentation/package checks:
  - task package contains `.ai-task.yaml`, `roadmap.md`, `00-overview.md`, `01-plan.md`, `02-architecture.md`, `03-implementation-notes.md`, `04-verification.md`, `05-pitfalls.md`
  - project governance sync/lint after package creation

- Backend implementation checks:
  - targeted admin media import route/service tests
  - targeted pool asset list and usage summary tests
  - existing media service/governance tests affected by orchestration

- Frontend implementation checks:
  - targeted admin/community import panel tests
  - API hook/type tests where applicable

- Whole-task checks:
  - `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict`
  - `node .ai/scripts/ctl-api-index.mjs generate --touch`
  - `node .ai/skills/features/context-awareness/scripts/ctl-context.mjs verify --strict`
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - `pnpm typecheck`
  - manual admin-console smoke for upload/URL success and validation failures

## Verification Log

- 2026-04-26: Task package creation started.
  - Result: package files created under `dev-docs/active/admin-community-media-import-console/`.
- 2026-04-26: `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: passed; T-302 registered and project hub derived files regenerated.
- 2026-04-26: `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-302`
  - Result: passed; T-302 is registered as `planned` under `M-000 / F-000`.
- 2026-04-26: `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed.
- 2026-04-26: Permission model inspection for roadmap Q1.
  - Checked `src/backend/middleware/human-auth.ts`: authenticated human role is `user | admin`; admin guard is `requireAdmin`.
  - Checked `prisma/schema.prisma` and `src/backend/services/role-assignment-service.ts`: `RoleAssignment` targets `agentId` and stage/community roles for agents, not human community operators.
  - Checked `src/backend/routes/stage-incubation.ts`: role-assignment control plane is guarded by `requireAdmin`.
  - Result: Q1 resolved; T-302 phase-1 community media import is admin-only.
- 2026-04-26: Reuse policy default alignment for roadmap Q2.
  - User confirmed `allow_quote_original` remains a boolean/direct-original-reuse gate, not a reuse count.
  - User confirmed both community and global/platform media imports default `allow_quote_original=false`.
  - User confirmed the UI should include an explicit switch to enable direct original reuse.
  - Result: Q2 resolved.
- 2026-04-26: Listing and usage summary alignment for roadmap Q3.
  - Confirmed existing repositories can query pool bindings and assets without DB changes.
  - Confirmed existing admin lineage trace API can provide deeper audit details.
  - User confirmed phase 1 should include DB-backed simple history lists and usage visibility.
  - Result: Q3 resolved; scope is simple list plus lightweight usage summary, not full DAM/analytics.
- 2026-04-26: URL import alignment for roadmap Q4.
  - User confirmed phase 1 should support URL import.
  - Scope applies to both platform/global and community media import surfaces.
  - Result: Q4 resolved; URL import remains admin-only and must reuse existing remote image validation.
- 2026-04-26: Consumption readiness alignment for roadmap Q5.
  - Confirmed management UI should show imported assets immediately after existing asset/snapshot/pool/policy persistence.
  - Confirmed planner/retrieval use should be gated by existing retrieval/index readiness.
  - Result: Q5 resolved; UI/API should expose ready/pending/failed consumption status without new persistence.
- 2026-04-26: Endpoint, DTO, and frontend landing discovery.
  - Checked existing admin media route, agent media upload/URL routes, media container wiring, frontend admin routes, and community settings page.
  - Result: proposed admin media endpoints and DTOs are documented in `02-architecture.md`; product code not changed.
- 2026-04-26: Execution documentation pass.
  - Added `06-execution-runbook.md`.
  - Expanded `01-plan.md` with API-contract, backend, frontend, community, verification, and rollback execution detail.
  - Result: task package is ready for implementation confirmation; product code not changed.
- 2026-04-26: Coverage and contract review pass.
  - Added `07-coverage-and-contract-review.md`.
  - Closed execution-level gaps around `operator_note`, retrieval status definitions, community image selection, OpenAPI ordering, and slice review gates.
  - Result: task package can support step-by-step implementation review; product code not changed.

## Implementation Verification (2026-04-27)

### Slice 1 — API Contract And Backend Orchestration
- `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict` → `[ok] OpenAPI quality check passed.`
- `node .ai/scripts/ctl-api-index.mjs generate --touch` → `[ok] Generated docs/context/api/api-index.json (27 endpoints)`; API-INDEX.md regenerated.
- `node .ai/skills/features/context-awareness/scripts/ctl-context.mjs verify --strict` → `[ok] Context layer verification passed.`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` → `[ok] Lint passed.`
- Result: Six T-302 endpoints + DTO schemas added to `docs/context/api/openapi.yaml`; API index regenerated in the same batch; backend orchestration `AdminMediaImportService` wired through `src/backend/container/llm.ts` and exposed via `src/backend/container/index.ts`.

### Slice 2 — Backend Tests
- `vitest run src/backend/routes/__tests__/admin-media-import-routes.test.ts` → 15/15 passed (auth gates, upload happy/error, URL happy/non-https/private-network, allow_quote_original off/on, list, community surface).
- `vitest run src/backend/media/__tests__/admin-media-import-service.test.ts` → 4/4 passed (retrieval status three-state mapping: ready/pending/failed/no-doc).
- Regression sweep over existing tests touched by `defaultModesForSource` / `defaultCrossAgentQuoteAllowed` flip:
  - `media-reuse-governance-service.test.ts` → passed
  - `admin-media-api.test.ts` → passed
  - `media-injection-medium-regression.integration.test.ts` → passed
  - `media-injection-retrieval.integration.test.ts` → passed
- Result: T-302 backend coverage closed without breaking existing media governance / injection paths.

### Slice 3 — Frontend Admin Console
- `vitest run src/frontend/features/admin/components/__tests__/MediaImportPanel.test.tsx` → 6/6 passed (default off switch, error inline, list/empty states, tab controls, selectAction wiring).
- Manual code review: `/admin/media-assets` route mounted; admin sidebar entry under "内容生产"; `AdminPageWrapper` enforces admin-only via existing `currentIdentity !== 'admin'` guard; types align with shared `src/shared/admin-media-import.ts`.

### Slice 4 — Community Settings Integration
- `vitest run src/frontend/features/forum/pages/__tests__/CommunitySettingsPage.test.tsx` → 2/2 passed (existing custom participation case retained; placeholder dialog replaced by community commons import dialog assertion).
- `MediaImportPanel.selectAction` test confirms select buttons forward the imported item to the parent callback without mutating state inside the panel.
- Result: Imported community media writes only `selectedBannerUrl` / `selectedAvatarUrl` local state; existing `useApplyCommunitySurfaceSettings` save flow untouched.

### Slice 5 — Whole-task Verification
- `pnpm typecheck` (run as `tsc -b`) → clean except a single pre-existing `src/shared/kickoff-workflow.ts` reference to a tmp-only kickoff-local module (independently confirmed by stashing T-302 changes and re-running). T-302 introduces no new type errors.
- `git status --short` confirms zero changes under `prisma/`, `prisma/schema.prisma`, or any `migrations/` directory.
- `git diff --name-only` enumeration: 19 modified files (3 contract artifacts, 6 backend, 9 frontend, 1 frontend test) + 7 new files (1 shared DTO, 1 backend service, 2 backend tests, 1 frontend panel, 1 frontend tab page, 1 frontend test). No schema artifacts touched.
- Aggregate test run across T-302 + impacted regression: 47/47 passed across 8 test files in 3.5s.

### HTTP Smoke Harness (2026-04-27)

A self-contained Node smoke harness was added at `ops/smoke/t302/run-smoke.ts` (with companion `README.md`). It boots the real backend Express app in-process with in-memory repos, seeds a single test community via the container, listens on a configurable port, and issues real HTTP calls against every T-302 endpoint plus the auth gates.

Run command:

```bash
NODE_ENV=development APP_ENV=dev PORT=4103 \
JWT_SECRET=smoke-jwt-secret-not-for-prod \
SERVICE_AUTH_SECRET=smoke-service-secret-not-for-prod \
LOG_LEVEL=silent \
pnpm exec tsx ops/smoke/t302/run-smoke.ts
```

Result on this implementation pass: **11/11 assertions passed**.

```text
[ok] GET /health responds 200 with ok=true — lastStatus=200
[ok] Unauthenticated platform upload → 401 — status=401
[ok] Non-admin platform URL import → 403 — status=403
[ok] Platform upload (default) → 201 + scene=platform_canonical:global + no quote_original — status=201 scene=platform_canonical:global modes=[derive_new,reference_only]
[ok] Platform upload (allow_quote_original=true) includes quote_original mode — status=201 modes=[quote_original,derive_new,reference_only]
[ok] Platform URL import http:// → 400 — status=400
[ok] Platform URL import https://127.0.0.1 → 400 — status=400
[ok] Platform list returns DB-backed pool items — status=200 items=2
[ok] Community upload (default) → 201 + scene=community_commons:<id> + no quote_original — status=201 scene=community_commons:comm_… modes=[derive_new,reference_only]
[ok] Community list scoped to current community.id — status=200 items=1
[ok] Platform upload missing file → 400 — status=400
[summary] 11/11 assertions passed
```

What this verifies end-to-end through real HTTP:
- Auth middleware chain (`requireHumanAuth`, `requireAdmin`).
- `validate(adminMediaImportUrlBodySchema)` rejects `http://` and `https://127.0.0.1/...` before any network call.
- multer parses multipart uploads; missing-file path returns 400 cleanly.
- `AdminMediaImportService.importPlatformUpload` / `importPlatformUrl` / `importCommunityUpload` write through `ingestManagedAsset` and pool registration.
- `defaultModesForSource` and `defaultCrossAgentQuoteAllowed` honor `allow_quote_original` for `platform_canonical` (regression for the Slice 1 default flip).
- `listPlatformAssets` / `listCommunityAssets` assemble DTOs from existing repos with correct pool scoping.
- Community list strictly returns assets scoped to the seeded `community.id`.

### Browser-driven UI Smoke (2026-04-27)

A full front+back stack was stood up for live UI verification using Chrome MCP (DOM-aware browser automation, no native computer-use):

- Backend: `ops/smoke/t302/serve-ui.ts` running in-memory on `:4000` with a pre-seeded community (slug `t302-ui-smoke`).
- Frontend: `vite` dev server on `:3000`, proxying `/v1` and `/health` to the backend.
- Auth: admin dev token (`{userId:'smoke-admin',role:'admin'}` base64url) injected via `document.cookie = 'auth_token=...'` so the existing `requireHumanAuth` middleware accepted the request without changing any production code path.

#### Admin console — `/admin/media-assets`
- ✅ Sidebar shows the new "媒体素材导入" entry under "内容生产", and selecting it highlights the row.
- ✅ `AdminPageWrapper` renders title + description; the page is reachable only because the cookie carries `role=admin`.
- ✅ Default tab is "本地上传"; "允许直接引用原图（默认关闭，仅派生/参考）" checkbox renders **unchecked**; "导入资产" button starts disabled until a file is chosen.
- ✅ "远程 URL" tab swaps the form to a URL input (placeholder `https://cdn.example.com/image.png`) with the same default-off switch and a disabled-until-typed "导入远程图像" button.
- ✅ Real upload flow: a 1×1 PNG attached via `DataTransfer` + `change` event → POST `/v1/admin/media/platform-canonical/imports/upload` → 201 → "导入成功" card appears with `media_asset_…_00000001`, `image/png · 68 bytes · 1×1`, `建档中`, `默认仅派生/参考` badges.
- ✅ Pool list refreshes on success: card "素材池资产" updates from "（0 项）" to "（1 项）"; the new row shows `derive_new · reference_only`, `建档中`, `绑定 1 次`, `公开展示 1 次`, `最近使用 …`, retrieval reason `gateway_not_configured` (matches the in-memory test config).

#### Community settings — `/c/t302-ui-smoke/settings`
- ✅ "编辑" enters edit mode; "视觉设置" panel shows; clicking "编辑 Banner" opens the banner picker and surfaces "上传图片" trigger.
- ✅ "上传图片" button replaces the legacy "功能正在开发" placeholder dialog with the new `CommunityCommonsImportDialog`; title reads "导入社区公共素材", description references `community_commons:<communityId>`, and the panel header echoes the same scene id.
- ✅ Default-off switch and disabled "导入资产" button match the admin surface.
- ✅ Real upload via dialog → 201 → "导入成功" result card carries a "选作 Banner" button (label adapts to the active visual target).
- ✅ Pool list inside the dialog refreshes to "（1 项）" and renders a second "选作 Banner" button on the list row.
- ✅ Clicking "选作 Banner" auto-closes the dialog and writes the imported `media_url` (`/v1/media/local/smoke-admin/2026-04-27/<uuid>.png`) to the local `selectedBannerUrl` draft state — confirmed by inspecting `<img>` srcs (`mediaSourcedSrcs` count = 1, matching the imported asset).
- ✅ The "保存" button visibly switches to its primary/filled style after the select, indicating `isDirty=true`. **No** PATCH/POST against the community surface fires until the user explicitly clicks "保存"; the existing `useApplyCommunitySurfaceSettings` flow remains the sole writer of `banner_image_url` / `avatar_image_url`.

All Slice 3 and Slice 4 review-gate items in `07-coverage-and-contract-review.md` are now backed by both API-level (HTTP smoke harness) and DOM-level (Chrome MCP) evidence.
