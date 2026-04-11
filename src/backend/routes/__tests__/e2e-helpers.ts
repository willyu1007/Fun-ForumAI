import { beforeEach, afterEach } from 'vitest'
import request, { type Response } from 'supertest'
import { app } from '../../app.js'
import { createServiceToken } from '../../middleware/service-auth.js'
import { createDevToken } from '../../middleware/human-auth.js'
import { config } from '../../lib/config.js'
import { resetReadApiRouteTestState } from '../read-api.js'
import {
  communityRepo,
  forumReadService,
  postRepo,
  publicStageThreadRepo,
  searchProjectionService,
  stageTierService,
} from '../../container.js'

export { app, config }

function getDatabaseName(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null
  try {
    return new URL(rawUrl).pathname.replace(/^\//, '') || null
  } catch {
    return null
  }
}

function assertPersistentTestsUseIsolatedDatabase() {
  if (!config.db.usePrisma) return
  if (process.env.E2E_PERSISTENT_DB_ISOLATED === 'true') return

  const dbName = getDatabaseName(process.env.DATABASE_URL ?? config.db.url)
  throw new Error(
    `[e2e] Refusing to run persistent E2E tests against shared database${dbName ? ` "${dbName}"` : ''}. `
      + 'Use `pnpm test:e2e:pg:isolated` or set up an explicit isolated DATABASE_URL with E2E_PERSISTENT_DB_ISOLATED=true.',
  )
}

assertPersistentTestsUseIsolatedDatabase()

export const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5NQAAAAASUVORK5CYII=',
  'base64',
)

export const adminToken = createDevToken({ userId: 'admin1', email: 'admin@test.com', role: 'admin' })
export const userToken = createDevToken({ userId: 'user1', email: 'user@test.com', role: 'user' })
export const user2Token = createDevToken({ userId: 'user2', email: 'user2@test.com', role: 'user' })

const serviceAgentAliasMap = new Map<string, string>()
const serviceAgentMemberships = new Map<string, Set<string>>()
const serviceCommunityAliasMap = new Map<string, string>()
const servicePostCommunityMap = new Map<string, string>()
const serviceThreadCommunityMap = new Map<string, string>()

beforeEach(() => {
  serviceAgentAliasMap.clear()
  serviceAgentMemberships.clear()
  serviceCommunityAliasMap.clear()
  servicePostCommunityMap.clear()
  serviceThreadCommunityMap.clear()
  forumReadService.resetRuntimeCachesForTests()
  resetReadApiRouteTestState()
})

export function setupFeatureFlagGuard() {
  let featureFlagSnapshot = { ...(config.launch.capabilities as unknown as Record<string, unknown>) }

  beforeEach(() => {
    featureFlagSnapshot = { ...(config.launch.capabilities as unknown as Record<string, unknown>) }
  })

  afterEach(() => {
    Object.assign(config.launch.capabilities as unknown as Record<string, unknown>, featureFlagSnapshot)
  })
}

export async function withFeatureFlags<T>(
  overrides: Record<string, boolean>,
  run: () => Promise<T>,
): Promise<T> {
  const featureFlags = config.launch.capabilities as unknown as Record<string, boolean | undefined>
  const snapshot = new Map<string, boolean | undefined>()

  for (const [key, value] of Object.entries(overrides)) {
    snapshot.set(key, featureFlags[key])
    featureFlags[key] = value
  }

  try {
    return await run()
  } finally {
    for (const [key, value] of snapshot.entries()) {
      if (value === undefined) {
        delete featureFlags[key]
      } else {
        featureFlags[key] = value
      }
    }
  }
}

export async function createAgentViaApi(input: {
  displayName: string
  token?: string
}): Promise<{
  id: string
  response: Response
}> {
  const response = await request(app)
    .post('/v1/agents')
    .set('Authorization', `Bearer ${input.token ?? userToken}`)
    .send({ display_name: input.displayName })

  if (response.status !== 201 || typeof response.body?.data?.id !== 'string') {
    throw new Error(
      `[e2e] failed to create agent "${input.displayName}" (status=${response.status})`,
    )
  }

  return {
    id: response.body.data.id as string,
    response,
  }
}

export async function patchAgentMembershipViaApi(input: {
  agentId: string
  add: string[]
  remove?: string[]
  token?: string
}): Promise<Response> {
  return request(app)
    .patch(`/v1/agents/${input.agentId}/memberships`)
    .set('Authorization', `Bearer ${input.token ?? userToken}`)
    .send({
      add: input.add,
      remove: input.remove ?? [],
    })
}

function rememberAgentMembership(agentId: string, communityId: string): void {
  const current = serviceAgentMemberships.get(agentId)
  if (current) {
    current.add(communityId)
    return
  }
  serviceAgentMemberships.set(agentId, new Set([communityId]))
}

async function inferServiceWriteCommunityId(path: string, body: Record<string, unknown>): Promise<string | null> {
  if (path === '/v1/posts' && typeof body.community_id === 'string') {
    return body.community_id
  }

  const threadMatch = path.match(/^\/v1\/posts\/([^/]+)\/threads$/)
  if (threadMatch) {
    return servicePostCommunityMap.get(threadMatch[1]) ?? null
  }

  const turnMatch = path.match(/^\/v1\/threads\/([^/]+)\/turns$/)
  if (turnMatch) {
    const cached = serviceThreadCommunityMap.get(turnMatch[1])
    if (cached) {
      return cached
    }

    const thread = await publicStageThreadRepo.findById(turnMatch[1])
    if (!thread) {
      return null
    }

    const post = await postRepo.findById(thread.post_id)
    return post?.community_id ?? null
  }

  return null
}

async function createServiceWriteAgent(alias: string): Promise<string> {
  const cached = serviceAgentAliasMap.get(alias)
  if (cached) return cached

  const createAgentRes = await request(app)
    .post('/v1/agents')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      display_name: `E2E ${alias}`.slice(0, 48),
    })

  if (createAgentRes.status !== 201 || typeof createAgentRes.body?.data?.id !== 'string') {
    throw new Error(`[e2e] failed to auto-provision service agent for alias ${alias}`)
  }

  const actualAgentId = createAgentRes.body.data.id as string
  serviceAgentAliasMap.set(alias, actualAgentId)
  return actualAgentId
}

async function resolveServiceCommunityId(requestedCommunityId: string): Promise<string> {
  const existingCommunity = communityRepo.findById(requestedCommunityId)
  if (existingCommunity) {
    return existingCommunity.id
  }

  const cached = serviceCommunityAliasMap.get(requestedCommunityId)
  if (cached) {
    return cached
  }

  const createPersisted = communityRepo.createPersisted?.bind(communityRepo)
  const community = createPersisted
    ? await createPersisted({
        name: `E2E Community ${requestedCommunityId}`,
        slug: `e2e-${requestedCommunityId}-${Date.now()}`,
      })
    : communityRepo.create({
        name: `E2E Community ${requestedCommunityId}`,
        slug: `e2e-${requestedCommunityId}-${Date.now()}`,
      })
  await searchProjectionService.refreshCommunity(community.id)
  serviceCommunityAliasMap.set(requestedCommunityId, community.id)
  return community.id
}

async function ensureAgentMembership(agentId: string, communityId: string): Promise<boolean> {
  if (serviceAgentMemberships.get(agentId)?.has(communityId)) {
    return true
  }

  const membershipRes = await request(app)
    .patch(`/v1/agents/${agentId}/memberships`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ add: [communityId], remove: [] })

  if (membershipRes.status !== 200) {
    return false
  }

  rememberAgentMembership(agentId, communityId)
  return true
}

async function ensureWritableStageTier(agentId: string): Promise<void> {
  const snapshotRepo = (
    stageTierService as unknown as {
      deps?: {
        snapshotRepo?: {
          upsert(input: {
            agent_id: string
            tier: 'T4'
            score: number
            achievement_points: number
            chronicle_points: number
            trust_penalty: number
            reasoning: Record<string, unknown>
          }): Promise<unknown>
        }
      }
    }
  ).deps?.snapshotRepo

  await snapshotRepo?.upsert({
    agent_id: agentId,
    tier: 'T4',
    score: 320,
    achievement_points: 200,
    chronicle_points: 120,
    trust_penalty: 0,
    reasoning: {
      source: 'e2e_helper',
      note: 'Provision write-capable stage tier for launch-path service tests',
    },
  })
}

async function resolveServiceActorAgentId(
  requestedAgentId: string,
  communityId: string | null,
): Promise<string> {
  const aliasedAgentId = serviceAgentAliasMap.get(requestedAgentId) ?? requestedAgentId
  if (!communityId) {
    return aliasedAgentId
  }

  if (await ensureAgentMembership(aliasedAgentId, communityId)) {
    await ensureWritableStageTier(aliasedAgentId)
    return aliasedAgentId
  }

  const provisionedAgentId = await createServiceWriteAgent(requestedAgentId)
  const membershipReady = await ensureAgentMembership(provisionedAgentId, communityId)
  if (!membershipReady) {
    throw new Error(
      `[e2e] failed to ensure membership for service agent ${requestedAgentId} in community ${communityId}`,
    )
  }

  await ensureWritableStageTier(provisionedAgentId)

  return provisionedAgentId
}

export async function servicePost(path: string, body: Record<string, unknown>): Promise<Response> {
  const nextBody = { ...body }
  const requestedCommunityId = await inferServiceWriteCommunityId(path, body)
  const communityId =
    typeof requestedCommunityId === 'string'
      ? await resolveServiceCommunityId(requestedCommunityId)
      : null
  if (path === '/v1/posts' && communityId) {
    nextBody.community_id = communityId
  }
  if (typeof body.actor_agent_id === 'string') {
    nextBody.actor_agent_id = await resolveServiceActorAgentId(body.actor_agent_id, communityId)
  }

  const bodyStr = JSON.stringify(nextBody)
  const token = createServiceToken('agent-runtime', bodyStr)
  const response = await request(app).post(path).set('X-Service-Token', token).send(nextBody)

  if (response.status === 201 && typeof response.body?.data?.id === 'string' && communityId) {
    if (path === '/v1/posts') {
      servicePostCommunityMap.set(response.body.data.id as string, communityId)
    }

    if (/^\/v1\/posts\/[^/]+\/threads$/.test(path)) {
      serviceThreadCommunityMap.set(response.body.data.id as string, communityId)
    }
  }

  return response
}

export async function waitFor<T>(
  loader: () => Promise<T>,
  opts: { timeoutMs?: number; intervalMs?: number; pass: (value: T) => boolean },
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 1500
  const intervalMs = opts.intervalMs ?? 60
  const startedAt = Date.now()
  let last: T | null = null

  while (Date.now() - startedAt < timeoutMs) {
    const next = await loader()
    last = next
    if (opts.pass(next)) return next
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  if (last === null) {
    throw new Error('waitFor exhausted without any attempts')
  }
  return last
}

export async function createTestCommunity(input: {
  name: string
  slug: string
  description?: string
  rules_json?: Record<string, unknown>
}) {
  const createPersisted = communityRepo.createPersisted?.bind(communityRepo)
  const community = createPersisted
    ? await createPersisted(input)
    : communityRepo.create(input)
  await searchProjectionService.refreshCommunity(community.id)
  return community
}
