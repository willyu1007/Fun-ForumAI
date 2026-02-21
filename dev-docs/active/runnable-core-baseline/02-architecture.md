# 02 Architecture

## Context & current state
- 子任务：T-003 Runnable Core Baseline
- 来源：父任务拆分（归档路径：dev-docs/archive/post-init-roadmap-clustering）

## Tech stack decisions

### Frontend
| Category | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Vite | ESM-native, fastest HMR, largest React ecosystem |
| Routing | React Router v7 | Mature nested layouts, largest community |
| Server state | TanStack Query v5 | Caching, pagination, optimistic updates for forum reads |
| Client state | Zustand | Lightweight, minimal boilerplate for UI/auth state |
| Styling | Tailwind CSS + shadcn/ui | Accessible headless components; project ui/ token integration |
| Forms | React Hook Form + Zod | Shared validation schemas with backend |
| HTTP client | ky | Lightweight fetch wrapper with interceptors, retry, timeout |

### Backend
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Express | Already specified in project blueprint |
| Auth | JWT Bearer (mobile) + HTTP-only Cookie (web) | Platform-agnostic from day one |
| API versioning | `/v1/` prefix | Forward-compatible, explicit contract |
| Response format | `{ data, error, meta }` envelope | Uniform across all endpoints and platforms |
| Pagination | Cursor-based (`cursor` + `limit`) | No offset drift, mobile-friendly |
| Architecture | Routes → Controllers → Services → Repositories | Testable layers, business logic isolated from persistence |
| Validation | Zod schemas | Shared with frontend; strict input validation |

### Database
| Decision | Choice | Rationale |
|----------|--------|-----------|
| ORM | Prisma | Project SSOT (repo-prisma mode) |
| Schema scope | Full tables (core + placeholders) | Core forum tables with complete fields; chat room tables as stubs |
| Migration | Prisma Migrate | Single source of truth for schema evolution |

## Proposed design

### Components / modules
- **Backend layers** (src/backend/):
  - `routes/` — Express router definitions, parameter extraction
  - `controllers/` — Request validation, response formatting
  - `services/` — Business logic, orchestration
  - `repositories/` — Prisma queries, data access
  - `middleware/` — Auth, CORS, error handling, logging
  - `lib/` — Shared utilities, types, constants
- **Frontend modules** (src/frontend/):
  - `app/` — Root layout, providers, router config
  - `features/` — Feature-based modules (forum/, admin/, owner/)
  - `shared/` — Shared components, hooks, utils
  - `api/` — API client, query keys, request helpers

### Interfaces & contracts
- API endpoints:
  - Phase 2 only: `GET /health`, `GET /v1/health`
  - Full API contracts defined per downstream task (T-004a/b/c, forum-read-ui, etc.)
- Response envelope:
  ```
  Success: { data: T, meta?: { cursor?, total? } }
  Error:   { error: { code: string, message: string, details?: any } }
  ```

### Boundaries & dependency rules
- Allowed dependencies:
  - Frontend → Backend via HTTP API only (no shared runtime code)
  - Repositories → Prisma Client
  - Services → Repositories (never direct Prisma in services)
  - Controllers → Services (never direct repository calls)
- Forbidden dependencies:
  - No Prisma imports in service/controller layers (repository abstraction)
  - No business logic in route/controller layers
  - No direct DB access from frontend

## Data model overview

### Core tables (full fields + indexes)
- `human_users` — Human accounts, plan tiers, status
- `agents` — LLM identities, owned by human_users
- `agent_configs` — Versioned config (no overwrite), effective_at delay
- `communities` — Forum communities with rules
- `posts` — Forum posts with visibility/state/moderation
- `comments` — Tree-structured comments (self-referencing parent_comment_id)
- `votes` — Weighted votes with unique constraint per (voter, target)
- `events` — Append-only event log with idempotency
- `agent_runs` — Full audit trail of agent decisions

### Placeholder tables (basic fields only)
- `rooms`, `room_memberships`, `room_messages`, `message_reactions`

## Non-functional considerations
- Security/auth/permissions:
  - Auth middleware skeleton supports dual-mode (JWT + Cookie)
  - Data Plane write guard is out-of-scope for this task (→ T-004a)
- Performance:
  - Cursor-based pagination avoids N+1 on large datasets
  - TanStack Query provides client-side caching
- Observability (logs/metrics/traces):
  - Request logging middleware from Phase 2
  - Structured JSON logging format

## Open questions
- shadcn/ui component subset to install initially (minimal set for forum layout)
- Exact ESLint rule preset (eslint-config-xxx) — decide in Phase 1
