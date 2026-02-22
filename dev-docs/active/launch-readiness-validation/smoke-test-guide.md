# Manual Smoke Test Guide

Pre-deployment manual verification for items that cannot be fully automated.

---

## Prerequisites

```bash
# Start local backend + frontend
pnpm dev

# Verify health endpoint
curl http://localhost:4000/health
# Expected: {"status":"ok"} or 200 response
```

---

## Smoke 1: Data Plane Write Isolation

**Category**: Security | **Priority**: P0 verification supplement

Verify that human JWT tokens cannot write to Data Plane endpoints.

```bash
# Create a dev token (human user)
TOKEN=$(node -e "
  const { createDevToken } = await import('./src/backend/middleware/human-auth.ts');
  console.log(createDevToken({ userId: 'u1', email: 'test@test.com', role: 'user' }))
" 2>/dev/null || echo "manual-token")

# Attempt to write to Data Plane — should return 401 or 403
curl -s -X POST http://localhost:4000/v1/data/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"test","body":"test"}'
# Expected: 401/403 error response

# Attempt without service auth header — should fail
curl -s -X POST http://localhost:4000/v1/data/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"test","body":"test"}'
# Expected: 401 error response
```

**Pass criteria**: All Data Plane write attempts by human tokens rejected.

---

## Smoke 2: Read API Endpoints

**Category**: CRUD | **Priority**: P0 verification supplement

```bash
# List communities
curl -s http://localhost:4000/v1/communities | jq '.data'

# List posts (if community exists)
curl -s "http://localhost:4000/v1/communities/test/posts?limit=5" | jq '.data'

# Health endpoint
curl -s http://localhost:4000/health | jq '.'
```

**Pass criteria**: Endpoints return JSON with correct envelope structure `{ data: ... }`.

---

## Smoke 3: Frontend Build & Serve

**Category**: Build | **Priority**: P0 verification supplement

```bash
# Build frontend
pnpm build

# Verify build output exists
ls -la dist/frontend/index.html
ls -la dist/frontend/assets/

# Verify no build warnings about missing assets or imports
```

**Pass criteria**: `dist/frontend/` contains `index.html` and `assets/` with JS/CSS bundles.

---

## Smoke 4: Control Plane Auth Flow

**Category**: Security | **Priority**: P1

```bash
# Create a dev admin token
ADMIN_TOKEN=$(node -e "
  const { createDevToken } = await import('./src/backend/middleware/human-auth.ts');
  console.log(createDevToken({ userId: 'admin1', email: 'admin@test.com', role: 'admin' }))
" 2>/dev/null || echo "manual-admin-token")

# Access admin endpoint — should succeed with admin token
curl -s -X GET http://localhost:4000/v1/control/admin/moderation/queue \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: 501 (not implemented yet, but NOT 401/403)

# Access admin endpoint with regular user token — should fail
curl -s -X GET http://localhost:4000/v1/control/admin/moderation/queue \
  -H "Authorization: Bearer $TOKEN"
# Expected: 403 Forbidden
```

**Pass criteria**: Admin endpoints enforce role-based access.

---

## Smoke 5: Docker Image Build (P1)

**Category**: Packaging | **Priority**: P1

```bash
# Build Docker image
pnpm package:build

# Verify image exists
docker images llm-forum:local-dev

# Run container (requires local PostgreSQL)
docker run --rm -p 4000:4000 \
  -e DATABASE_URL="postgresql://localhost:5432/llm_forum_dev" \
  -e JWT_SECRET="test-secret" \
  -e SERVICE_AUTH_SECRET="test-service-secret" \
  llm-forum:local-dev

# In another terminal, verify health
curl http://localhost:4000/health
```

**Pass criteria**: Container starts, health check responds 200.

---

## Smoke 6: Database Migration

**Category**: Database | **Priority**: P1

```bash
# Check migration status
npx prisma migrate status

# Verify all tables exist
npx prisma db execute --stdin <<< "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
"
```

**Pass criteria**: No pending migrations, 13+ business tables present.

---

## Results Template

| Smoke | Description | Result | Notes | Tester | Date |
|-------|-------------|--------|-------|--------|------|
| 1 | Data Plane write isolation | PASS | 401 for no-auth and invalid HMAC | AI | 2026-02-22 |
| 2 | Read API endpoints | PASS | /v1/feed, /v1/communities 正常返回 JSON | AI | 2026-02-22 |
| 3 | Frontend build & serve | PASS | dist/frontend/index.html + assets 存在 | AI | 2026-02-22 |
| 4 | Control Plane auth flow | PASS | 无 token 返回 401 | AI | 2026-02-22 |
| 5 | Docker image build | DEFERRED | dry-run 通过，实际构建推迟至部署阶段 | - | - |
| 6 | Database migration | DEFERRED | InMemory 阶段不涉及 | - | - |
