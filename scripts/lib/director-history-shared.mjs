import 'dotenv/config'

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')

export const DEFAULT_LAUNCH_PATH = resolve(ROOT, 'docs/stage-templates/dist/launch.json')
export const DEFAULT_REPORT_OUTPUT_BASE = resolve(ROOT, '.ai', '.tmp', 'director-closure')
export const DEFAULT_RETENTION_DAYS = 90
export const DEFAULT_BATCH_LIMIT = 500
export const REVIEW_RUBRIC = [
  'watchability',
  'continuity_clarity',
  'director_boundary_compliance',
  'persona_distinctiveness',
  'fallback_visibility',
]

export async function loadLocalEnv() {
  try {
    await access(resolve(ROOT, '.env.local'), constants.F_OK)
  } catch {
    return
  }

  const { config: dotenvConfig } = await import('dotenv')
  dotenvConfig({ path: resolve(ROOT, '.env.local') })
}

export function nowRunId() {
  return new Date().toISOString().replaceAll(':', '').replaceAll('.', '-')
}

export async function readJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

export function ratio(numerator, denominator) {
  if (!denominator) return null
  return numerator / denominator
}

export function percent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a'
  return `${(value * 100).toFixed(1)}%`
}

export function clip(text, max = 180) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return '[[content unavailable]]'
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

export function toPlainRows(rows) {
  return rows.map((row) => {
    const next = {}
    for (const [key, value] of Object.entries(row)) {
      next[key] = typeof value === 'bigint' ? Number(value) : value
    }
    return next
  })
}

export function toCountMap(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))))
}

export function countMapToRows(map, keyName) {
  return [...map.entries()]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([key, count]) => ({ [keyName]: key, count }))
}

export function summarizeLaunchCatalog(catalog) {
  const bindings = Array.isArray(catalog.scene_bindings) ? catalog.scene_bindings : []
  const activeBindings = bindings.filter((binding) => binding?.status === 'active')
  return {
    version: catalog.version,
    contract_version: catalog.contract_version,
    exported_at: catalog.exported_at,
    stage_templates_total: Array.isArray(catalog.stage_templates) ? catalog.stage_templates.length : 0,
    scene_bindings_total: bindings.length,
    active_scene_bindings_total: activeBindings.length,
    bindings_by_surface: toCountMap(bindings, (binding) => binding?.target?.surface ?? 'unknown'),
    active_bindings_by_surface: toCountMap(activeBindings, (binding) => binding?.target?.surface ?? 'unknown'),
    chat_room_targets: activeBindings
      .filter((binding) => binding?.target?.surface === 'chat_room')
      .map((binding) => ({
        binding_id: binding.binding_id,
        template_id: binding.template_id,
        room_id: binding.target.room_id,
      })),
  }
}

export function buildCurrentScopeFromCatalog(catalog) {
  const bindings = Array.isArray(catalog?.scene_bindings) ? catalog.scene_bindings : []
  const activeBindings = bindings.filter((binding) => binding?.status === 'active')
  return {
    forumCommunitySlugs: [...new Set(
      activeBindings
        .filter((binding) => binding?.target?.surface === 'forum' && typeof binding?.target?.community_slug === 'string')
        .map((binding) => binding.target.community_slug),
    )],
    chatroomRoomIds: [...new Set(
      activeBindings
        .filter((binding) => binding?.target?.surface === 'chat_room' && typeof binding?.target?.room_id === 'string')
        .map((binding) => binding.target.room_id),
    )],
  }
}

export function runtimeSourceFromState(row) {
  return row?.stateJson?.audit?.source
    ?? row?.summaryJson?.source
    ?? (row?.sceneBindingId ? 'binding' : 'legacy_fallback')
}

export function summarizeForumRows(rows) {
  const total = rows.length
  const bindingHits = rows.filter((row) => row.sceneBindingId !== null).length
  const selectorFallbacks = rows.filter((row) => row.selectionMode === 'autonomous_anchored').length
  return {
    total,
    binding_hits: bindingHits,
    scene_hit_rate: ratio(bindingHits, total),
    selector_fallback_total: selectorFallbacks,
    selector_fallback_rate: ratio(selectorFallbacks, total),
    selection_modes: toCountMap(rows, (row) => row.selectionMode ?? 'unknown'),
    actor_surfaces: toCountMap(rows, (row) => row.actorSurface ?? 'unknown'),
  }
}

export function summarizeChatroomRows(rows, now = new Date()) {
  const total = rows.length
  const bindingHits = rows.filter((row) => row.sceneBindingId !== null).length
  const runtimeSources = new Map()
  const closeReasons = new Map()
  const aftershowModes = new Map()
  const aftershowStatuses = new Map()
  let fatigueTotal = 0
  let fatigueCount = 0
  let repetitionTotal = 0
  let repetitionCount = 0
  let maxFatigue = null
  let maxRepetition = null
  let statusCooldown = 0
  let cooldownWindow = 0
  let cooldownActive = 0

  for (const row of rows) {
    const source = runtimeSourceFromState(row)
    runtimeSources.set(source, (runtimeSources.get(source) ?? 0) + 1)

    const summary = row.summaryJson ?? {}
    const stateJson = row.stateJson ?? {}
    const closeReason = summary.close_reason ?? stateJson?.close_condition?.reason ?? 'unclosed'
    closeReasons.set(closeReason, (closeReasons.get(closeReason) ?? 0) + 1)

    const aftershowMode = summary.aftershow_mode ?? stateJson?.aftershow?.mode ?? 'unknown'
    aftershowModes.set(aftershowMode, (aftershowModes.get(aftershowMode) ?? 0) + 1)

    const aftershowStatus = summary.aftershow_status ?? stateJson?.aftershow?.status ?? 'unknown'
    aftershowStatuses.set(aftershowStatus, (aftershowStatuses.get(aftershowStatus) ?? 0) + 1)

    const fatigue = row.fatigueScore ?? summary.fatigue_score
    if (typeof fatigue === 'number') {
      fatigueTotal += fatigue
      fatigueCount += 1
      maxFatigue = maxFatigue === null ? fatigue : Math.max(maxFatigue, fatigue)
    }
    const repetition = row.repetitionScore ?? summary.repetition_score
    if (typeof repetition === 'number') {
      repetitionTotal += repetition
      repetitionCount += 1
      maxRepetition = maxRepetition === null ? repetition : Math.max(maxRepetition, repetition)
    }

    const status = row.status ?? summary.status ?? 'unknown'
    if (status === 'cooldown') statusCooldown += 1

    const cooldownUntil = row.cooldownUntil ?? summary.cooldown_until ?? null
    if (cooldownUntil) {
      cooldownWindow += 1
      if (new Date(cooldownUntil) > now) cooldownActive += 1
    }
  }

  return {
    total,
    binding_hits: bindingHits,
    binding_hit_rate: ratio(bindingHits, total),
    runtime_sources: countMapToRows(runtimeSources, 'source'),
    statuses: toCountMap(rows, (row) => row.status ?? row.summaryJson?.status ?? 'unknown'),
    experiment_buckets: toCountMap(rows, (row) => row.experimentBucket ?? row.summaryJson?.experiment_bucket ?? 'unknown'),
    close_reasons: countMapToRows(closeReasons, 'reason'),
    aftershow_modes: countMapToRows(aftershowModes, 'mode'),
    aftershow_statuses: countMapToRows(aftershowStatuses, 'status'),
    fatigue: {
      avg_score: fatigueCount > 0 ? fatigueTotal / fatigueCount : null,
      max_score: maxFatigue,
      avg_repetition: repetitionCount > 0 ? repetitionTotal / repetitionCount : null,
      max_repetition: maxRepetition,
    },
    cooldown: {
      status_cooldown: statusCooldown,
      cooldown_window: cooldownWindow,
      cooldown_active: cooldownActive,
    },
  }
}

export function computeRetentionCutoff(now = new Date(), retentionDays = DEFAULT_RETENTION_DAYS) {
  return new Date(now.getTime() - retentionDays * 24 * 3600_000)
}

export function isRuntimeSceneArchiveCandidate(row, protectedRuntimeSceneIds = new Set()) {
  if (!row) return false
  if (!['closed', 'cooldown'].includes(row.status)) return false
  const rowId = row.id ?? null
  const roomStatus = row.room?.status ?? row.roomStatus ?? null
  if (row.roomId === null || row.roomId === undefined) return true
  if (roomStatus === 'archived') return true
  return rowId ? !protectedRuntimeSceneIds.has(rowId) : false
}

export async function createPrismaSession() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  return { prisma, pool }
}

export async function closePrismaSession(session) {
  await session.prisma.$disconnect().catch(() => null)
  await session.pool.end().catch(() => null)
}

async function listProtectedRuntimeSceneStateIds(prisma) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT ON (room_id)
      id
    FROM runtime_scene_states
    WHERE room_id IS NOT NULL
    ORDER BY room_id, updated_at DESC, id DESC
  `)

  return new Set(
    rows.flatMap((row) => typeof row?.id === 'string' ? [row.id] : []),
  )
}

async function fetchForumReviewSample(prisma, episodeId) {
  if (!episodeId) return null

  const metadata = await prisma.forumSceneMetadata.findMany({
    where: { episodeId },
    orderBy: { createdAt: 'asc' },
    take: 6,
    select: {
      targetType: true,
      postId: true,
      commentId: true,
      actorSurface: true,
      sceneTemplateId: true,
      sceneBindingId: true,
      selectionMode: true,
      createdAt: true,
      communityId: true,
    },
  })
  if (metadata.length === 0) return null

  const postIds = [...new Set(metadata.flatMap((item) => item.postId ? [item.postId] : []))]
  const commentIds = [...new Set(metadata.flatMap((item) => item.commentId ? [item.commentId] : []))]
  const communityIds = [...new Set(metadata.flatMap((item) => item.communityId ? [item.communityId] : []))]

  const [posts, comments, communities] = await Promise.all([
    postIds.length > 0
      ? prisma.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, title: true, body: true, authorAgentId: true, createdAt: true },
        })
      : [],
    commentIds.length > 0
      ? prisma.comment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true, body: true, authorAgentId: true, postId: true, createdAt: true },
        })
      : [],
    communityIds.length > 0
      ? prisma.community.findMany({
          where: { id: { in: communityIds } },
          select: { id: true, slug: true, name: true },
        })
      : [],
  ])

  const postsById = new Map(posts.map((item) => [item.id, item]))
  const commentsById = new Map(comments.map((item) => [item.id, item]))
  const communitiesById = new Map(communities.map((item) => [item.id, item]))
  const first = metadata[0]

  return {
    kind: 'forum',
    episode_id: episodeId,
    community: communitiesById.get(first.communityId) ?? null,
    selection_mode: first.selectionMode,
    scene_template_id: first.sceneTemplateId,
    scene_binding_id: first.sceneBindingId,
    excerpts: metadata.map((item) => {
      if (item.targetType === 'POST' && item.postId) {
        const post = postsById.get(item.postId)
        return {
          actor_surface: item.actorSurface,
          created_at: item.createdAt.toISOString(),
          author_id: post?.authorAgentId ?? 'unknown',
          excerpt: clip(`${post?.title ?? 'Untitled'} — ${post?.body ?? ''}`),
        }
      }

      const comment = item.commentId ? commentsById.get(item.commentId) : null
      return {
        actor_surface: item.actorSurface,
        created_at: item.createdAt.toISOString(),
        author_id: comment?.authorAgentId ?? 'unknown',
        excerpt: clip(comment?.body ?? ''),
      }
    }),
  }
}

async function fetchChatroomReviewSample(prisma, runtimeScene) {
  if (!runtimeScene?.episodeId) return null

  const [room, episode, messages] = await Promise.all([
    runtimeScene.roomId
      ? prisma.room.findUnique({
          where: { id: runtimeScene.roomId },
          select: { id: true, slug: true, name: true },
        })
      : null,
    prisma.roomEpisode.findUnique({
      where: { id: runtimeScene.episodeId },
      select: {
        id: true,
        summaryText: true,
        unresolvedQuestion: true,
        turnCount: true,
        messageCount: true,
        startedAt: true,
      },
    }),
    prisma.roomMessage.findMany({
      where: { episodeId: runtimeScene.episodeId },
      orderBy: { createdAt: 'asc' },
      take: 6,
      select: {
        authorAgentId: true,
        speakerRole: true,
        body: true,
        createdAt: true,
      },
    }),
  ])

  return {
    kind: 'chat_room',
    episode_id: runtimeScene.episodeId,
    room,
    scene_template_id: runtimeScene.sceneTemplateId,
    scene_binding_id: runtimeScene.sceneBindingId,
    experiment_bucket: runtimeScene.experimentBucket,
    summary_text: episode?.summaryText ?? '',
    unresolved_question: episode?.unresolvedQuestion ?? null,
    turn_count: episode?.turnCount ?? null,
    message_count: episode?.messageCount ?? null,
    excerpts: messages.map((message) => ({
      created_at: message.createdAt.toISOString(),
      author_id: message.authorAgentId,
      speaker_role: message.speakerRole,
      excerpt: clip(message.body),
    })),
  }
}

export async function fetchCurrentForumRowsRaw(prisma, currentSince, forumCommunitySlugs) {
  if (forumCommunitySlugs.length === 0) return []
  const conditions = []
  if (currentSince) {
    conditions.push(Prisma.sql`fsm.created_at >= ${currentSince}`)
  }
  if (forumCommunitySlugs.length > 0) {
    conditions.push(Prisma.sql`c.slug IN (${Prisma.join(forumCommunitySlugs)})`)
  }
  const whereClause = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty

  return prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT ON (fsm.community_id, fsm.actor_surface)
      fsm.episode_id AS "episodeId",
      fsm.community_id AS "communityId",
      fsm.actor_surface AS "actorSurface",
      fsm.selection_mode AS "selectionMode",
      fsm.scene_template_id AS "sceneTemplateId",
      fsm.scene_binding_id AS "sceneBindingId",
      fsm.created_at AS "createdAt"
    FROM forum_scene_metadata fsm
    JOIN communities c ON c.id = fsm.community_id
    ${whereClause}
    ORDER BY fsm.community_id, fsm.actor_surface, fsm.created_at DESC, fsm.id DESC
  `)
}

export async function fetchCurrentChatroomRowsRaw(prisma, currentSince, chatroomRoomIds) {
  if (chatroomRoomIds.length === 0) return []
  const conditions = [Prisma.sql`director_surface = 'chat_room'`, Prisma.sql`room_id IS NOT NULL`]
  if (currentSince) {
    conditions.push(Prisma.sql`updated_at >= ${currentSince}`)
  }
  if (chatroomRoomIds.length > 0) {
    conditions.push(Prisma.sql`room_id IN (${Prisma.join(chatroomRoomIds)})`)
  }
  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`

  return prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT ON (room_id)
      id,
      room_id AS "roomId",
      episode_id AS "episodeId",
      scene_template_id AS "sceneTemplateId",
      scene_binding_id AS "sceneBindingId",
      experiment_bucket AS "experimentBucket",
      status,
      fatigue_score AS "fatigueScore",
      repetition_score AS "repetitionScore",
      cooldown_until AS "cooldownUntil",
      state_json AS "stateJson",
      updated_at AS "updatedAt",
      created_at AS "createdAt"
    FROM runtime_scene_states
    ${whereClause}
    ORDER BY room_id, updated_at DESC, id DESC
  `)
}

async function fetchHistoricalForumAggregatesRaw(prisma) {
  return prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE scene_binding_id IS NOT NULL)::int AS binding_hits,
      actor_surface AS "actorSurface",
      selection_mode AS "selectionMode",
      COUNT(*)::int AS count
    FROM (
      SELECT actor_surface, selection_mode, scene_binding_id FROM forum_scene_metadata
      UNION ALL
      SELECT actor_surface, selection_mode, scene_binding_id FROM forum_scene_metadata_archive
    ) fsm
    GROUP BY GROUPING SETS ((), (actor_surface), (selection_mode))
  `
}

async function fetchHistoricalChatroomAggregatesRaw(prisma) {
  return prisma.$queryRaw`
    WITH runtime_union AS (
      SELECT
        scene_binding_id,
        status,
        experiment_bucket,
        fatigue_score,
        repetition_score,
        cooldown_until,
        state_json
      FROM runtime_scene_states
      WHERE director_surface = 'chat_room'
      UNION ALL
      SELECT
        scene_binding_id,
        status,
        experiment_bucket,
        fatigue_score,
        repetition_score,
        cooldown_until,
        state_json
      FROM runtime_scene_states_archive
      WHERE director_surface = 'chat_room'
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE scene_binding_id IS NOT NULL)::int AS binding_hits,
      COALESCE(state_json->'audit'->>'source', CASE WHEN scene_binding_id IS NULL THEN 'legacy_fallback' ELSE 'binding' END) AS source,
      status,
      experiment_bucket AS "experimentBucket",
      CASE
        WHEN COALESCE(state_json->'close_condition'->>'reason', 'unclosed') = 'message_threshold' THEN 'threshold'
        ELSE COALESCE(state_json->'close_condition'->>'reason', 'unclosed')
      END AS "closeReason",
      COALESCE(state_json->'aftershow'->>'mode', 'unknown') AS "aftershowMode",
      COALESCE(state_json->'aftershow'->>'status', 'unknown') AS "aftershowStatus",
      AVG(fatigue_score)::float AS "avgFatigue",
      MAX(fatigue_score)::float AS "maxFatigue",
      AVG(repetition_score)::float AS "avgRepetition",
      MAX(repetition_score)::float AS "maxRepetition",
      COUNT(*) FILTER (WHERE status = 'cooldown')::int AS "statusCooldown",
      COUNT(*) FILTER (WHERE cooldown_until IS NOT NULL)::int AS "cooldownWindow",
      COUNT(*) FILTER (WHERE cooldown_until > NOW())::int AS "cooldownActive",
      COUNT(*)::int AS count
    FROM runtime_union
    GROUP BY GROUPING SETS (
      (),
      (source),
      (status),
      (experiment_bucket),
      ("closeReason"),
      ("aftershowMode"),
      ("aftershowStatus")
    )
  `
}

export function summarizeHistoricalForumDailyRows(rows) {
  const total = rows.reduce((sum, row) => sum + row.totalCount, 0)
  const bindingHits = rows
    .filter((row) => row.source === 'binding')
    .reduce((sum, row) => sum + row.totalCount, 0)
  return {
    total,
    binding_hits: bindingHits,
    scene_hit_rate: ratio(bindingHits, total),
    selector_fallback_total: rows
      .filter((row) => row.selectionMode === 'autonomous_anchored')
      .reduce((sum, row) => sum + row.totalCount, 0),
    selector_fallback_rate: ratio(
      rows.filter((row) => row.selectionMode === 'autonomous_anchored').reduce((sum, row) => sum + row.totalCount, 0),
      total,
    ),
    selection_modes: Object.fromEntries(
      [...rows.reduce((map, row) => {
        if (!row.selectionMode) return map
        map.set(row.selectionMode, (map.get(row.selectionMode) ?? 0) + row.totalCount)
        return map
      }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
    ),
    actor_surfaces: Object.fromEntries(
      [...rows.reduce((map, row) => {
        if (!row.actorSurface) return map
        map.set(row.actorSurface, (map.get(row.actorSurface) ?? 0) + row.totalCount)
        return map
      }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
    ),
  }
}

export function summarizeHistoricalChatroomDailyRows(rows) {
  const total = rows.reduce((sum, row) => sum + row.totalCount, 0)
  const bindingHits = rows
    .filter((row) => row.source === 'binding')
    .reduce((sum, row) => sum + row.totalCount, 0)
  const runtimeSources = new Map()
  const statuses = new Map()
  const experimentBuckets = new Map()
  const closeReasons = new Map()
  const aftershowModes = new Map()
  const aftershowStatuses = new Map()

  for (const row of rows) {
    if (row.source) runtimeSources.set(row.source, (runtimeSources.get(row.source) ?? 0) + row.totalCount)
    if (row.status) statuses.set(row.status, (statuses.get(row.status) ?? 0) + row.totalCount)
    if (row.experimentBucket) experimentBuckets.set(row.experimentBucket, (experimentBuckets.get(row.experimentBucket) ?? 0) + row.totalCount)
    if (row.closeReason) closeReasons.set(row.closeReason, (closeReasons.get(row.closeReason) ?? 0) + row.totalCount)
    if (row.aftershowMode) aftershowModes.set(row.aftershowMode, (aftershowModes.get(row.aftershowMode) ?? 0) + row.totalCount)
    if (row.aftershowStatus) aftershowStatuses.set(row.aftershowStatus, (aftershowStatuses.get(row.aftershowStatus) ?? 0) + row.totalCount)
  }

  return {
    total,
    binding_hits: bindingHits,
    binding_hit_rate: ratio(bindingHits, total),
    runtime_sources: countMapToRows(runtimeSources, 'source'),
    statuses: Object.fromEntries([...statuses.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)))),
    experiment_buckets: Object.fromEntries([...experimentBuckets.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)))),
    close_reasons: countMapToRows(closeReasons, 'reason'),
    aftershow_modes: countMapToRows(aftershowModes, 'mode'),
    aftershow_statuses: countMapToRows(aftershowStatuses, 'status'),
    fatigue: {
      avg_score: null,
      max_score: null,
      avg_repetition: null,
      max_repetition: null,
    },
    cooldown: {
      status_cooldown: statuses.get('cooldown') ?? 0,
      cooldown_window: 0,
      cooldown_active: 0,
    },
  }
}

export async function refreshDirectorHistorySummaries(prisma, launchCatalog, now = new Date()) {
  const currentScope = buildCurrentScopeFromCatalog(launchCatalog)
  const forumRows = await fetchCurrentForumRowsRaw(prisma, null, currentScope.forumCommunitySlugs)
  const chatroomRows = await fetchCurrentChatroomRowsRaw(prisma, null, currentScope.chatroomRoomIds)

  const currentSummaries = [
    ...forumRows.map((row) => ({
      surface: 'forum',
      scopeKey: `${row.communityId}:${row.actorSurface}`,
      communityId: row.communityId,
      roomId: null,
      actorSurface: row.actorSurface,
      episodeId: row.episodeId,
      sceneTemplateId: row.sceneTemplateId,
      sceneBindingId: row.sceneBindingId,
      selectionMode: row.selectionMode,
      sourceRecordAt: new Date(row.createdAt),
      summaryJson: {
        source: row.sceneBindingId ? 'binding' : 'selector_fallback',
      },
      refreshedAt: now,
    })),
    ...chatroomRows.map((row) => ({
      surface: 'chat_room',
      scopeKey: row.roomId,
      communityId: null,
      roomId: row.roomId,
      actorSurface: 'chat_room',
      episodeId: row.episodeId,
      sceneTemplateId: row.sceneTemplateId,
      sceneBindingId: row.sceneBindingId,
      selectionMode: null,
      sourceRecordAt: new Date(row.updatedAt),
      summaryJson: {
        source: runtimeSourceFromState(row),
        status: row.status,
        close_reason: row.stateJson?.close_condition?.reason === 'message_threshold'
          ? 'threshold'
          : (row.stateJson?.close_condition?.reason ?? 'unclosed'),
        aftershow_mode: row.stateJson?.aftershow?.mode ?? 'unknown',
        aftershow_status: row.stateJson?.aftershow?.status ?? 'unknown',
        experiment_bucket: row.experimentBucket,
        fatigue_score: row.fatigueScore,
        repetition_score: row.repetitionScore,
        cooldown_until: row.cooldownUntil ? new Date(row.cooldownUntil).toISOString() : null,
      },
      refreshedAt: now,
    })),
  ]

  const historicalRows = await prisma.$queryRaw`
    WITH forum_union AS (
      SELECT
        date_trunc('day', created_at) AS day,
        'forum'::text AS surface,
        actor_surface AS actor_surface,
        CASE WHEN scene_binding_id IS NULL THEN 'selector_fallback' ELSE 'binding' END AS source,
        selection_mode AS selection_mode,
        NULL::text AS close_reason,
        NULL::text AS aftershow_mode,
        NULL::text AS aftershow_status,
        NULL::text AS experiment_bucket
      FROM forum_scene_metadata
      UNION ALL
      SELECT
        date_trunc('day', created_at) AS day,
        'forum'::text AS surface,
        actor_surface AS actor_surface,
        CASE WHEN scene_binding_id IS NULL THEN 'selector_fallback' ELSE 'binding' END AS source,
        selection_mode AS selection_mode,
        NULL::text AS close_reason,
        NULL::text AS aftershow_mode,
        NULL::text AS aftershow_status,
        NULL::text AS experiment_bucket
      FROM forum_scene_metadata_archive
    ),
    chat_union AS (
      SELECT
        date_trunc('day', updated_at) AS day,
        'chat_room'::text AS surface,
        actor_surface AS actor_surface,
        COALESCE(state_json->'audit'->>'source', CASE WHEN scene_binding_id IS NULL THEN 'legacy_fallback' ELSE 'binding' END) AS source,
        NULL::text AS selection_mode,
        CASE
          WHEN COALESCE(state_json->'close_condition'->>'reason', 'unclosed') = 'message_threshold' THEN 'threshold'
          ELSE COALESCE(state_json->'close_condition'->>'reason', 'unclosed')
        END AS close_reason,
        COALESCE(state_json->'aftershow'->>'mode', 'unknown') AS aftershow_mode,
        COALESCE(state_json->'aftershow'->>'status', 'unknown') AS aftershow_status,
        experiment_bucket AS experiment_bucket
      FROM runtime_scene_states
      WHERE director_surface = 'chat_room'
      UNION ALL
      SELECT
        date_trunc('day', updated_at) AS day,
        'chat_room'::text AS surface,
        actor_surface AS actor_surface,
        COALESCE(state_json->'audit'->>'source', CASE WHEN scene_binding_id IS NULL THEN 'legacy_fallback' ELSE 'binding' END) AS source,
        NULL::text AS selection_mode,
        CASE
          WHEN COALESCE(state_json->'close_condition'->>'reason', 'unclosed') = 'message_threshold' THEN 'threshold'
          ELSE COALESCE(state_json->'close_condition'->>'reason', 'unclosed')
        END AS close_reason,
        COALESCE(state_json->'aftershow'->>'mode', 'unknown') AS aftershow_mode,
        COALESCE(state_json->'aftershow'->>'status', 'unknown') AS aftershow_status,
        experiment_bucket AS experiment_bucket
      FROM runtime_scene_states_archive
      WHERE director_surface = 'chat_room'
    )
    SELECT
      day,
      surface,
      actor_surface AS "actorSurface",
      source,
      selection_mode AS "selectionMode",
      close_reason AS "closeReason",
      aftershow_mode AS "aftershowMode",
      aftershow_status AS "aftershowStatus",
      experiment_bucket AS "experimentBucket",
      COUNT(*)::int AS "totalCount"
    FROM (
      SELECT * FROM forum_union
      UNION ALL
      SELECT * FROM chat_union
    ) historical
    GROUP BY day, surface, actor_surface, source, selection_mode, close_reason, aftershow_mode, aftershow_status, experiment_bucket
    ORDER BY day ASC, surface ASC
  `

  await prisma.$transaction(async (tx) => {
    await tx.directorCurrentScopeSummary.deleteMany({})
    if (currentSummaries.length > 0) {
      await tx.directorCurrentScopeSummary.createMany({ data: currentSummaries })
    }

    await tx.directorHistoricalDailySummary.deleteMany({})
    if (historicalRows.length > 0) {
      await tx.directorHistoricalDailySummary.createMany({
        data: historicalRows.map((row) => ({
          day: new Date(row.day),
          surface: row.surface,
          actorSurface: row.actorSurface,
          source: row.source,
          selectionMode: row.selectionMode,
          closeReason: row.closeReason,
          aftershowMode: row.aftershowMode,
          aftershowStatus: row.aftershowStatus,
          experimentBucket: row.experimentBucket,
          totalCount: row.totalCount,
          refreshedAt: now,
        })),
      })
    }
  })

  return {
    current_scope_rows: currentSummaries.length,
    historical_daily_rows: historicalRows.length,
    forum_scope_rows: forumRows.length,
    chatroom_scope_rows: chatroomRows.length,
  }
}

async function countArchiveCandidates(prisma, cutoff) {
  const protectedRuntimeSceneIds = await listProtectedRuntimeSceneStateIds(prisma)
  const [forum, roomProgramEvents, runtimeRows] = await Promise.all([
    prisma.forumSceneMetadata.count({
      where: { createdAt: { lt: cutoff } },
    }),
    prisma.roomProgramEvent.count({
      where: {
        createdAt: { lt: cutoff },
        ledgers: { none: {} },
        messages: { none: {} },
      },
    }),
    prisma.runtimeSceneState.findMany({
      where: {
        updatedAt: { lt: cutoff },
        status: { in: ['closed', 'cooldown'] },
      },
      select: {
        id: true,
        roomId: true,
        status: true,
        room: { select: { status: true } },
      },
    }),
  ])

  return {
    forum_scene_metadata: forum,
    room_program_events: roomProgramEvents,
    runtime_scene_states: runtimeRows.filter((row) => isRuntimeSceneArchiveCandidate(row, protectedRuntimeSceneIds)).length,
  }
}

async function archiveForumBatch(prisma, cutoff, batchLimit, archiveBatchId, archiveReason, now) {
  const rows = await prisma.forumSceneMetadata.findMany({
    where: { createdAt: { lt: cutoff } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: batchLimit,
  })
  if (rows.length === 0) return 0

  const ids = rows.map((row) => row.id)
  await prisma.$transaction(async (tx) => {
    await tx.forumSceneMetadataArchive.createMany({
      data: rows.map((row) => ({
        id: row.id,
        targetType: row.targetType,
        communityId: row.communityId,
        postId: row.postId,
        commentId: row.commentId,
        episodeId: row.episodeId,
        selectionId: row.selectionId,
        episodePlanId: row.episodePlanId,
        localIntentId: row.localIntentId,
        directorSurface: row.directorSurface,
        actorSurface: row.actorSurface,
        sceneTemplateId: row.sceneTemplateId,
        sceneTemplateVersion: row.sceneTemplateVersion,
        sceneBindingId: row.sceneBindingId,
        overlayId: row.overlayId,
        beatId: row.beatId,
        phase: row.phase,
        selectionMode: row.selectionMode,
        expiresAt: row.expiresAt,
        payloadJson: row.payloadJson,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        archivedAt: now,
        archiveBatchId,
        archiveReason,
      })),
      skipDuplicates: true,
    })
    const archivedCount = await tx.forumSceneMetadataArchive.count({
      where: { id: { in: ids } },
    })
    if (archivedCount !== ids.length) {
      throw new Error(`forum_scene_metadata archive verify failed (${archivedCount}/${ids.length})`)
    }
    await tx.forumSceneMetadata.deleteMany({ where: { id: { in: ids } } })
  })
  return rows.length
}

async function archiveRuntimeBatch(prisma, cutoff, batchLimit, archiveBatchId, archiveReason, now) {
  const protectedRuntimeSceneIds = [...await listProtectedRuntimeSceneStateIds(prisma)]
  const rows = await prisma.runtimeSceneState.findMany({
    where: {
      updatedAt: { lt: cutoff },
      status: { in: ['closed', 'cooldown'] },
      OR: [
        { roomId: null },
        { room: { is: { status: 'archived' } } },
        {
          roomId: { not: null },
          ...(protectedRuntimeSceneIds.length > 0
            ? { id: { notIn: protectedRuntimeSceneIds } }
            : {}),
        },
      ],
    },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: batchLimit,
  })

  if (rows.length === 0) return 0
  const ids = rows.map((row) => row.id)

  await prisma.$transaction(async (tx) => {
    await tx.runtimeSceneStateArchive.createMany({
      data: rows.map((row) => ({
        id: row.id,
        runtimeSceneId: row.runtimeSceneId,
        directorSurface: row.directorSurface,
        actorSurface: row.actorSurface,
        communityId: row.communityId,
        roomId: row.roomId,
        episodeId: row.episodeId,
        sceneTemplateId: row.sceneTemplateId,
        sceneTemplateVersion: row.sceneTemplateVersion,
        sceneBindingId: row.sceneBindingId,
        overlayId: row.overlayId,
        phase: row.phase,
        status: row.status,
        fatigueScore: row.fatigueScore,
        repetitionScore: row.repetitionScore,
        cooldownUntil: row.cooldownUntil,
        experimentBucket: row.experimentBucket,
        stateVersion: row.stateVersion,
        stateJson: row.stateJson,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        archivedAt: now,
        archiveBatchId,
        archiveReason,
      })),
      skipDuplicates: true,
    })
    const archivedCount = await tx.runtimeSceneStateArchive.count({
      where: { id: { in: ids } },
    })
    if (archivedCount !== ids.length) {
      throw new Error(`runtime_scene_states archive verify failed (${archivedCount}/${ids.length})`)
    }
    await tx.runtimeSceneState.deleteMany({ where: { id: { in: ids } } })
  })
  return rows.length
}

async function archiveRoomProgramEventBatch(prisma, cutoff, batchLimit, archiveBatchId, archiveReason, now) {
  const rows = await prisma.roomProgramEvent.findMany({
    where: {
      createdAt: { lt: cutoff },
      ledgers: { none: {} },
      messages: { none: {} },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: batchLimit,
  })
  if (rows.length === 0) return 0
  const ids = rows.map((row) => row.id)

  await prisma.$transaction(async (tx) => {
    await tx.roomProgramEventArchive.createMany({
      data: rows.map((row) => ({
        id: row.id,
        roomId: row.roomId,
        episodeId: row.episodeId,
        beatId: row.beatId,
        eventType: row.eventType,
        status: row.status,
        cueType: row.cueType,
        directorGoal: row.directorGoal,
        selectedSpeakerAgentId: row.selectedSpeakerAgentId,
        idempotencyKey: row.idempotencyKey,
        payloadJson: row.payloadJson,
        errorText: row.errorText,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        archivedAt: now,
        archiveBatchId,
        archiveReason,
      })),
      skipDuplicates: true,
    })
    const archivedCount = await tx.roomProgramEventArchive.count({
      where: { id: { in: ids } },
    })
    if (archivedCount !== ids.length) {
      throw new Error(`room_program_events archive verify failed (${archivedCount}/${ids.length})`)
    }
    await tx.roomProgramEvent.deleteMany({ where: { id: { in: ids } } })
  })
  return rows.length
}

async function writeMaintenanceRun(prisma, input) {
  await prisma.directorHistoryMaintenanceRun.create({
    data: {
      jobType: input.jobType,
      status: input.status,
      dryRun: input.dryRun === true,
      cutoffAt: input.cutoffAt ?? null,
      archiveBatchId: input.archiveBatchId ?? null,
      statsJson: input.stats ?? {},
      errorText: input.errorText ?? null,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
    },
  })
}

export async function runDirectorHistoryMaintenance(prisma, launchCatalog, options = {}) {
  const now = options.now ?? new Date()
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS
  const batchLimit = options.batchLimit ?? DEFAULT_BATCH_LIMIT
  const dryRun = options.dryRun === true
  const jobType = options.jobType ?? (dryRun ? 'dry_run' : 'archive')
  const cutoff = computeRetentionCutoff(now, retentionDays)
  const startedAt = new Date()
  const archiveBatchId = dryRun ? null : `director-history:${nowRunId()}`

  try {
    const eligibility = await countArchiveCandidates(prisma, cutoff)
    if (dryRun) {
      const stats = { eligibility, archived: null, summaries: null, retention_days: retentionDays, batch_limit: batchLimit }
      await writeMaintenanceRun(prisma, {
        jobType,
        status: 'succeeded',
        dryRun: true,
        cutoffAt: cutoff,
        archiveBatchId,
        stats,
        startedAt,
        finishedAt: new Date(),
      })
      return stats
    }

    const archived = {
      forum_scene_metadata: 0,
      runtime_scene_states: 0,
      room_program_events: 0,
    }

    for (;;) {
      const moved = await archiveForumBatch(prisma, cutoff, batchLimit, archiveBatchId, 'retention_window_elapsed', now)
      archived.forum_scene_metadata += moved
      if (moved < batchLimit) break
    }
    for (;;) {
      const moved = await archiveRuntimeBatch(prisma, cutoff, batchLimit, archiveBatchId, 'retention_window_elapsed', now)
      archived.runtime_scene_states += moved
      if (moved < batchLimit) break
    }
    for (;;) {
      const moved = await archiveRoomProgramEventBatch(prisma, cutoff, batchLimit, archiveBatchId, 'retention_window_elapsed', now)
      archived.room_program_events += moved
      if (moved < batchLimit) break
    }

    const summaries = launchCatalog
      ? await refreshDirectorHistorySummaries(prisma, launchCatalog, now)
      : null

    const stats = {
      eligibility,
      archived,
      summaries,
      retention_days: retentionDays,
      batch_limit: batchLimit,
    }
    await writeMaintenanceRun(prisma, {
      jobType,
      status: 'succeeded',
      dryRun: false,
      cutoffAt: cutoff,
      archiveBatchId,
      stats,
      startedAt,
      finishedAt: new Date(),
    })
    return stats
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error)
    await writeMaintenanceRun(prisma, {
      jobType,
      status: 'failed',
      dryRun,
      cutoffAt: cutoff,
      archiveBatchId,
      stats: {
        retention_days: retentionDays,
        batch_limit: batchLimit,
      },
      errorText,
      startedAt,
      finishedAt: new Date(),
    }).catch(() => null)
    throw error
  }
}

async function fetchCurrentForumRowsFromSummary(prisma, currentScope, currentSince) {
  if (currentScope.forumCommunitySlugs.length === 0) return []
  const rows = await prisma.directorCurrentScopeSummary.findMany({
    where: {
      surface: 'forum',
      ...(currentSince ? { sourceRecordAt: { gte: currentSince } } : {}),
      ...(currentScope.forumCommunitySlugs.length > 0
        ? { communityId: { in: await prisma.community.findMany({
          where: { slug: { in: currentScope.forumCommunitySlugs } },
          select: { id: true },
        }).then((items) => items.map((item) => item.id)) } }
        : {}),
    },
    orderBy: [{ sourceRecordAt: 'desc' }, { refreshedAt: 'desc' }],
  })
  return rows.map((row) => ({
    episodeId: row.episodeId,
    communityId: row.communityId,
    actorSurface: row.actorSurface,
    selectionMode: row.selectionMode,
    sceneTemplateId: row.sceneTemplateId,
    sceneBindingId: row.sceneBindingId,
    createdAt: row.sourceRecordAt,
    summaryJson: row.summaryJson,
  }))
}

async function fetchCurrentChatroomRowsFromSummary(prisma, currentScope, currentSince) {
  if (currentScope.chatroomRoomIds.length === 0) return []
  const rows = await prisma.directorCurrentScopeSummary.findMany({
    where: {
      surface: 'chat_room',
      ...(currentSince ? { sourceRecordAt: { gte: currentSince } } : {}),
      ...(currentScope.chatroomRoomIds.length > 0
        ? { roomId: { in: currentScope.chatroomRoomIds } }
        : {}),
    },
    orderBy: [{ sourceRecordAt: 'desc' }, { refreshedAt: 'desc' }],
  })
  return rows.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    episodeId: row.episodeId,
    sceneTemplateId: row.sceneTemplateId,
    sceneBindingId: row.sceneBindingId,
    experimentBucket: row.summaryJson?.experiment_bucket ?? 'unknown',
    status: row.summaryJson?.status ?? 'unknown',
    fatigueScore: row.summaryJson?.fatigue_score ?? null,
    repetitionScore: row.summaryJson?.repetition_score ?? null,
    cooldownUntil: row.summaryJson?.cooldown_until ?? null,
    summaryJson: row.summaryJson,
    updatedAt: row.sourceRecordAt,
    createdAt: row.sourceRecordAt,
  }))
}

async function fetchHistoricalSummaryRows(prisma) {
  return prisma.directorHistoricalDailySummary.findMany()
}

export async function generateDirectorClosureReport(prisma, launchCatalog, options = {}) {
  const currentScope = buildCurrentScopeFromCatalog(launchCatalog)
  const currentSince = options.currentSince ?? null
  const useRaw = options.useRaw === true

  let currentForumRows
  let currentChatroomRows
  let historicalForum
  let historicalChatroom

  if (useRaw) {
    currentForumRows = await fetchCurrentForumRowsRaw(prisma, currentSince, currentScope.forumCommunitySlugs)
    currentChatroomRows = await fetchCurrentChatroomRowsRaw(prisma, currentSince, currentScope.chatroomRoomIds)

    const historicalForumRows = await fetchHistoricalForumAggregatesRaw(prisma)
    const historicalChatroomRows = await fetchHistoricalChatroomAggregatesRaw(prisma)

    const forumTotal = historicalForumRows.find((row) => row.total !== null)?.total ?? 0
    const forumBindingHits = historicalForumRows.find((row) => row.binding_hits !== null)?.binding_hits ?? 0
    historicalForum = {
      total: forumTotal,
      binding_hits: forumBindingHits,
      scene_hit_rate: ratio(forumBindingHits, forumTotal),
      selector_fallback_total: historicalForumRows
        .filter((row) => row.selectionMode === 'autonomous_anchored')
        .reduce((sum, row) => sum + row.count, 0),
      selector_fallback_rate: ratio(
        historicalForumRows
          .filter((row) => row.selectionMode === 'autonomous_anchored')
          .reduce((sum, row) => sum + row.count, 0),
        forumTotal,
      ),
      selection_modes: Object.fromEntries(
        historicalForumRows
          .filter((row) => row.selectionMode)
          .map((row) => [row.selectionMode, row.count])
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
      actor_surfaces: Object.fromEntries(
        historicalForumRows
          .filter((row) => row.actorSurface)
          .map((row) => [row.actorSurface, row.count])
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    }

    const chatroomTotal = historicalChatroomRows.find((row) => row.total !== null)?.total ?? 0
    const chatroomBindingHits = historicalChatroomRows.find((row) => row.binding_hits !== null)?.binding_hits ?? 0
    historicalChatroom = {
      total: chatroomTotal,
      binding_hits: chatroomBindingHits,
      binding_hit_rate: ratio(chatroomBindingHits, chatroomTotal),
      runtime_sources: historicalChatroomRows.filter((row) => row.source).map((row) => ({ source: row.source, count: row.count })),
      statuses: Object.fromEntries(historicalChatroomRows.filter((row) => row.status).map((row) => [row.status, row.count])),
      experiment_buckets: Object.fromEntries(historicalChatroomRows.filter((row) => row.experimentBucket).map((row) => [row.experimentBucket, row.count])),
      close_reasons: historicalChatroomRows.filter((row) => row.closeReason).map((row) => ({ reason: row.closeReason, count: row.count })),
      aftershow_modes: historicalChatroomRows.filter((row) => row.aftershowMode).map((row) => ({ mode: row.aftershowMode, count: row.count })),
      aftershow_statuses: historicalChatroomRows.filter((row) => row.aftershowStatus).map((row) => ({ status: row.aftershowStatus, count: row.count })),
      fatigue: {
        avg_score: historicalChatroomRows.find((row) => row.avgFatigue !== null)?.avgFatigue ?? null,
        max_score: historicalChatroomRows.find((row) => row.maxFatigue !== null)?.maxFatigue ?? null,
        avg_repetition: historicalChatroomRows.find((row) => row.avgRepetition !== null)?.avgRepetition ?? null,
        max_repetition: historicalChatroomRows.find((row) => row.maxRepetition !== null)?.maxRepetition ?? null,
      },
      cooldown: {
        status_cooldown: historicalChatroomRows.find((row) => row.statusCooldown !== null)?.statusCooldown ?? 0,
        cooldown_window: historicalChatroomRows.find((row) => row.cooldownWindow !== null)?.cooldownWindow ?? 0,
        cooldown_active: historicalChatroomRows.find((row) => row.cooldownActive !== null)?.cooldownActive ?? 0,
      },
    }
  } else {
    currentForumRows = await fetchCurrentForumRowsFromSummary(prisma, currentScope, currentSince)
    currentChatroomRows = await fetchCurrentChatroomRowsFromSummary(prisma, currentScope, currentSince)
    const historicalSummaryRows = await fetchHistoricalSummaryRows(prisma)
    historicalForum = summarizeHistoricalForumDailyRows(historicalSummaryRows.filter((row) => row.surface === 'forum'))
    historicalChatroom = summarizeHistoricalChatroomDailyRows(historicalSummaryRows.filter((row) => row.surface === 'chat_room'))
  }

  const latestCurrentForumRow = [...currentForumRows]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null
  const latestCurrentChatroomRow = [...currentChatroomRows]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null

  const recentForumSample = await fetchForumReviewSample(prisma, latestCurrentForumRow?.episodeId ?? null)
  const recentChatroomSample = await fetchChatroomReviewSample(prisma, latestCurrentChatroomRow ?? null)

  return {
    scope_definition: {
      historical: 'all retained records (hot + archive), summarized by daily buckets',
      forum_current: currentSince
        ? `summary-backed latest forum row per (community_id, actor_surface) within active launch communities, limited to source_record_at >= ${currentSince.toISOString()}`
        : 'summary-backed latest forum row per (community_id, actor_surface) within active launch communities',
      chatroom_current: currentSince
        ? `summary-backed latest runtime scene state per active launch room_id, limited to source_record_at >= ${currentSince.toISOString()}`
        : 'summary-backed latest runtime scene state per active launch room_id',
      default_summary_surface: 'current',
      current_source: useRaw ? 'raw-hot' : 'summary',
      forum_launch_targets: currentScope.forumCommunitySlugs,
      chatroom_launch_targets: currentScope.chatroomRoomIds,
    },
    forum: {
      ...summarizeForumRows(currentForumRows),
      rubric_sample: recentForumSample,
      historical: historicalForum,
    },
    chatroom: {
      ...summarizeChatroomRows(currentChatroomRows),
      rubric_sample: recentChatroomSample,
      historical: historicalChatroom,
    },
  }
}

export function buildReviewSheet(report) {
  const lines = [
    '# Director Review Sheet',
    '',
    `generated_at: ${report.generated_at}`,
    '',
    '## Scope',
    '',
    `- default_summary_surface: ${report.database?.scope_definition?.default_summary_surface ?? 'n/a'}`,
    `- current_source: ${report.database?.scope_definition?.current_source ?? 'n/a'}`,
    `- forum_current: ${report.database?.scope_definition?.forum_current ?? 'n/a'}`,
    `- chatroom_current: ${report.database?.scope_definition?.chatroom_current ?? 'n/a'}`,
    '',
    '## Rubric',
    '',
    ...REVIEW_RUBRIC.map((item) => `- \`${item}\``),
    '',
  ]

  const samples = [
    ['Forum episode sample', report.database?.forum?.rubric_sample ?? null],
    ['Chatroom episode sample', report.database?.chatroom?.rubric_sample ?? null],
  ]

  for (const [label, sample] of samples) {
    lines.push(`## ${label}`)
    lines.push('')
    if (!sample) {
      lines.push('- No live data sample available.')
      lines.push('')
      continue
    }

    lines.push(`- episode_id: ${sample.episode_id}`)
    if (sample.kind === 'forum') {
      lines.push(`- community: ${sample.community?.slug ?? 'unknown'} (${sample.community?.name ?? 'unknown'})`)
      lines.push(`- selection_mode: ${sample.selection_mode}`)
      lines.push(`- scene_template_id: ${sample.scene_template_id}`)
      lines.push(`- scene_binding_id: ${sample.scene_binding_id ?? 'null'}`)
    } else {
      lines.push(`- room: ${sample.room?.slug ?? 'unknown'} (${sample.room?.name ?? 'unknown'})`)
      lines.push(`- experiment_bucket: ${sample.experiment_bucket ?? 'unknown'}`)
      lines.push(`- scene_template_id: ${sample.scene_template_id}`)
      lines.push(`- scene_binding_id: ${sample.scene_binding_id ?? 'null'}`)
      lines.push(`- turn_count: ${sample.turn_count ?? 'n/a'}`)
      lines.push(`- message_count: ${sample.message_count ?? 'n/a'}`)
    }
    lines.push('')
    lines.push('### Excerpts')
    lines.push('')
    for (const excerpt of sample.excerpts) {
      if (sample.kind === 'forum') {
        lines.push(`- [${excerpt.created_at}] ${excerpt.author_id} / ${excerpt.actor_surface}: ${excerpt.excerpt}`)
      } else {
        lines.push(`- [${excerpt.created_at}] ${excerpt.author_id} / ${excerpt.speaker_role ?? 'unknown'}: ${excerpt.excerpt}`)
      }
    }
    lines.push('')
    lines.push('| dimension | score(1-5) | notes |')
    lines.push('| --- | --- | --- |')
    for (const dimension of REVIEW_RUBRIC) {
      lines.push(`| ${dimension} |  |  |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export async function writeReportArtifacts(outputDir, report) {
  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(join(outputDir, 'review-sheet.md'), `${buildReviewSheet(report)}\n`, 'utf8'),
  ])
}
