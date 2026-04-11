import { Router, type IRouter } from 'express'
import multer from 'multer'
import { requireHumanAuth } from '../middleware/human-auth.js'
import * as container from '../container.js'
import { AppError, ValidationError } from '../lib/errors.js'
import { ensureDevAuthUserPersisted } from '../lib/dev-auth-user.js'
import { getUnexpectedErrorLogMessage, getUnexpectedErrorMessage } from '../lib/public-error-message.js'
import { buildAgentReadPayload } from '../identity/agent-identity.js'
import {
  buildAgentPublicAuthorPresentation,
  mergeAgentPublicProjection,
} from '../identity/public-author-presentation.js'
import { trackGuidanceEventFromRequest } from '../guidance/http.js'
import type { SourceDimension } from '../../shared/owner-life-overview.js'
import type { Agent } from '../repos/types.js'

const DEV_SEED_AGENT_KEYS = new Set([
  'dev-user-001::苏格拉底-7B',
  'dev-user-001::洛芙蕾丝',
  'dev-user-001::辩论大师',
  'dev-user-001::俳句师',
  'dev-admin-001::代码审查官',
])

function getServices() {
  return container.privateChannelServices
}

function getRelationService() {
  return container.relationService
}

function getOwnerLifeOverviewService() {
  return container.ownerLifeOverviewService
}

function parseSourceDimension(value: unknown): SourceDimension | undefined {
  if (value === 'WORLD' || value === 'SOCIAL' || value === 'OWNER' || value === 'SYSTEM') {
    return value
  }
  return undefined
}

function collapseManagedSeedAgentDuplicates(agents: Agent[]): Agent[] {
  const canonicalByKey = new Map<string, Agent>()
  const passthrough: Agent[] = []

  for (const agent of agents) {
    const key = `${agent.owner_id}::${agent.display_name}`
    if (!DEV_SEED_AGENT_KEYS.has(key)) {
      passthrough.push(agent)
      continue
    }

    const current = canonicalByKey.get(key)
    if (!current) {
      canonicalByKey.set(key, agent)
      continue
    }

    const currentCreatedAt = current.created_at.getTime()
    const nextCreatedAt = agent.created_at.getTime()
    if (nextCreatedAt < currentCreatedAt || (nextCreatedAt === currentCreatedAt && agent.id < current.id)) {
      canonicalByKey.set(key, agent)
    }
  }

  return [...passthrough, ...canonicalByKey.values()].sort((left, right) =>
    right.created_at.getTime() - left.created_at.getTime()
    || right.id.localeCompare(left.id))
}

export const privateChannelRouter: IRouter = Router()
const privateAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

async function assertAgentOwner(
  agentId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  try {
    const agent = await container.agentService.getAgentPersisted(agentId)
    if (agent.owner_id !== userId) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Not your agent' }
    }
    if (agent.status === 'DELETED') {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'This agent has left and no longer exposes private surfaces',
      }
    }
    return { ok: true }
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      return { ok: false, status: 404, code: 'NOT_FOUND', message: `Agent ${agentId} not found` }
    }
    throw err
  }
}

// ─── Owner private aggregates ───────────────────────────────

privateChannelRouter.get('/private/agents/:agentId/life-overview', requireHumanAuth, async (req, res) => {
  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const data = await getOwnerLifeOverviewService().getLifeOverview(String(req.params.agentId))
    res.json({ data })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.get('/private/agents/:agentId/chronicle-feed', requireHumanAuth, async (req, res) => {
  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const limitRaw = parseInt(String(req.query.limit ?? '12'), 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 12
    const cursor = req.query.cursor as string | undefined
    const result = await getOwnerLifeOverviewService().getChronicleFeed(String(req.params.agentId), {
      cursor,
      limit,
      chapter_key: typeof req.query.chapter_key === 'string' ? req.query.chapter_key : undefined,
      actor_id: typeof req.query.actor_id === 'string' ? req.query.actor_id : undefined,
      scene_label: typeof req.query.scene_label === 'string' ? req.query.scene_label : undefined,
      source_dimension: parseSourceDimension(req.query.source_dimension),
    })

    res.json({
      data: {
        agent_id: result.agent_id,
        chapter: result.chapter,
        items: result.items,
      },
      meta: {
        cursor: result.next_cursor,
        folded_count: result.folded_count,
        degraded: result.chapter === null,
      },
    })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.get('/private/agents/:agentId/nurture-suggestions', requireHumanAuth, async (req, res) => {
  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const data = await getOwnerLifeOverviewService().getNurtureSuggestions(String(req.params.agentId))
    res.json({ data })
  } catch (err) {
    handleError(res, err)
  }
})

// ─── Session endpoints ──────────────────────────────────────

privateChannelRouter.post('/agents/:agentId/chat/sessions', requireHumanAuth, async (req, res) => {
  const services = getServices()
  if (!services) {
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
    return
  }

  try {
    await ensureDevAuthUserPersisted(req.user!)
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const session = await services.channelService.createSession(
      String(req.params.agentId),
      req.user!.userId,
    )
    await trackGuidanceEventFromRequest(
      req,
      res,
      container.guidanceOrchestrator,
      'PRIVATE_SESSION_CREATED',
      {
        agent_id: String(req.params.agentId),
        session_id: session.id,
      },
      { dedup_key: `private_session_created:${req.user!.userId}:${session.id}` },
    )
    res.status(201).json({ data: session })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.get('/agents/:agentId/chat/sessions', requireHumanAuth, async (req, res) => {
  const services = getServices()
  if (!services) {
    res.json({ data: { items: [], next_cursor: null } })
    return
  }

  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 50)
    const cursor = req.query.cursor as string | undefined
    const status = req.query.status as string | undefined

    const result = await services.channelService.listSessions(String(req.params.agentId), req.user!.userId, {
      limit,
      cursor,
      status: status as 'ACTIVE' | 'ENDED' | 'ARCHIVED' | undefined,
    })
    res.json({ data: result })
  } catch (err) {
    handleError(res, err)
  }
})

// ─── Message endpoints ──────────────────────────────────────

privateChannelRouter.post(
  '/agents/:agentId/chat/sessions/:sessionId/attachments',
  requireHumanAuth,
  async (req, res, next) => {
    try {
      const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
      if (!ownership.ok) {
        res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
        return
      }

      const services = getServices()
      if (!services) {
        res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
        return
      }

      privateAttachmentUpload.single('file')(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            next(new ValidationError('media exceeds 10MB limit'))
            return
          }
          next(new ValidationError('invalid upload payload'))
          return
        }

        try {
          if (!req.file || req.file.size <= 0) {
            throw new ValidationError('file is required')
          }

          const attachment = await services.channelService.uploadAttachment({
            agentId: String(req.params.agentId),
            sessionId: String(req.params.sessionId),
            humanUserId: req.user!.userId,
            mimeType: req.file.mimetype,
            bytes: req.file.buffer,
          })
          res.status(201).json({ data: attachment })
        } catch (uploadErr) {
          next(uploadErr)
        }
      })
    } catch (err) {
      next(err)
    }
  },
)

privateChannelRouter.post(
  '/agents/:agentId/chat/sessions/:sessionId/messages',
  requireHumanAuth,
  async (req, res) => {
    const content = typeof req.body?.content === 'string' ? req.body.content : ''
    const attachmentAssetIds = Array.isArray(req.body?.attachment_asset_ids)
      ? req.body.attachment_asset_ids
      : req.body?.attachment_asset_ids === undefined
        ? undefined
        : null
    if (attachmentAssetIds === null || (Array.isArray(attachmentAssetIds) && attachmentAssetIds.some((item) => typeof item !== 'string'))) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'attachment_asset_ids must be a string array when provided' },
      })
      return
    }
    if (!content.trim() && (!attachmentAssetIds || attachmentAssetIds.length === 0)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'content or attachment_asset_ids is required' },
      })
      return
    }

    try {
      const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
      if (!ownership.ok) {
        res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
        return
      }

      const services = getServices()
      if (!services) {
        res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
        return
      }

      const beforeCount = await services.channelService.getMessageCount(String(req.params.sessionId))
      const result = await services.channelService.sendMessage(
        String(req.params.sessionId),
        req.user!.userId,
        {
          content,
          attachment_asset_ids: attachmentAssetIds ?? undefined,
        },
      )
      if (beforeCount === 0) {
        await trackGuidanceEventFromRequest(
          req,
          res,
          container.guidanceOrchestrator,
          'PRIVATE_FIRST_MESSAGE_SENT',
          {
            agent_id: String(req.params.agentId),
            session_id: String(req.params.sessionId),
          },
          { dedup_key: `private_first_message:${req.user!.userId}:${String(req.params.sessionId)}` },
        )
      }
      res.json({ data: result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

privateChannelRouter.get(
  '/agents/:agentId/chat/sessions/:sessionId/messages',
  requireHumanAuth,
  async (req, res) => {
    try {
      const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
      if (!ownership.ok) {
        res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
        return
      }

      const services = getServices()
      if (!services) {
        res.json({ data: { items: [], next_cursor: null } })
        return
      }

      const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 100)
      const cursor = req.query.cursor as string | undefined
      const result = await services.channelService.getMessages(String(req.params.sessionId), req.user!.userId, {
        limit,
        cursor,
      })
      res.json({ data: result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

// ─── Session lifecycle ──────────────────────────────────────

privateChannelRouter.post(
  '/agents/:agentId/chat/sessions/:sessionId/end',
  requireHumanAuth,
  async (req, res) => {
    const services = getServices()
    if (!services) {
      res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
      return
    }

    try {
      const session = await services.channelService.endSession(
        String(req.params.sessionId),
        req.user!.userId,
      )

      services.memoryService.generateDigest(session.id).catch((err) => {
        console.error('[PrivateChannelAPI] Digest generation failed:', err)
      })

      await trackGuidanceEventFromRequest(
        req,
        res,
        container.guidanceOrchestrator,
        'PRIVATE_SESSION_ENDED',
        {
          agent_id: String(req.params.agentId),
          session_id: String(req.params.sessionId),
        },
        { dedup_key: `private_session_ended:${req.user!.userId}:${String(req.params.sessionId)}` },
      )
      res.json({ data: { session, digest_status: 'GENERATING' } })
    } catch (err) {
      handleError(res, err)
    }
  },
)

// ─── Memory endpoints ───────────────────────────────────────

privateChannelRouter.get('/agents/:agentId/memories', requireHumanAuth, async (req, res) => {
  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const services = getServices()
    if (!services) {
      res.json({ data: { items: [], next_cursor: null } })
      return
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 50)
    const cursor = req.query.cursor as string | undefined
    const sourceType = req.query.source_type as string | undefined
    const sourceSessionId = req.query.source_session_id as string | undefined
    const sourceRefType = req.query.source_ref_type as string | undefined
    const sourceRefId = req.query.source_ref_id as string | undefined
    const forgotten = req.query.forgotten === 'true' ? true
      : req.query.forgotten === 'false' ? false
      : undefined

    const result = await services.memoryService.listMemories(String(req.params.agentId), {
      limit,
      cursor,
      source_type: sourceType as 'PRIVATE_CHAT' | 'PUBLIC_OBSERVATION' | 'SYSTEM' | undefined,
      source_session_id: sourceSessionId,
      source_ref_type: sourceRefType,
      source_ref_id: sourceRefId,
      forgotten,
    })
    await trackGuidanceEventFromRequest(
      req,
      res,
      container.guidanceOrchestrator,
      'MEMORIES_VIEWED',
      {
        agent_id: String(req.params.agentId),
        source_session_id: sourceSessionId ?? null,
      },
      { dedup_key: `memories_viewed:${req.user!.userId}:${String(req.params.agentId)}:${sourceSessionId ?? 'all'}:${cursor ?? 'root'}` },
    )
    res.json({ data: result })
  } catch (err) {
    handleError(res, err)
  }
})

// ─── Privacy settings ───────────────────────────────────────

privateChannelRouter.get('/agents/:agentId/privacy-settings', requireHumanAuth, async (req, res) => {
  const services = getServices()
  if (!services) {
    res.json({
      data: {
        agent_id: String(req.params.agentId),
        disclosure_level: 1,
        public_memory_budget: 1000,
        public_memory_top_k: 4,
        public_disclosure_cap: null,
      },
    })
    return
  }

  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const settings = await services.memoryService.getPrivacySettings(String(req.params.agentId))
    res.json({ data: settings })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.patch('/agents/:agentId/privacy-settings', requireHumanAuth, async (req, res) => {
  const services = getServices()
  if (!services) {
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
    return
  }

  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const { disclosure_level, public_memory_budget, public_memory_top_k, public_disclosure_cap } = req.body ?? {}

    if (disclosure_level !== undefined) {
      const level = Number(disclosure_level)
      if (isNaN(level) || level < 0 || level > 3) {
        throw new ValidationError('disclosure_level must be 0-3')
      }
    }

    const settings = await services.memoryService.updatePrivacySettings(
      String(req.params.agentId),
      req.user!.userId,
      {
        disclosure_level: disclosure_level !== undefined ? Number(disclosure_level) : undefined,
        public_memory_budget: public_memory_budget !== undefined ? Number(public_memory_budget) : undefined,
        public_memory_top_k: public_memory_top_k !== undefined ? Number(public_memory_top_k) : undefined,
        public_disclosure_cap: public_disclosure_cap === null
          ? null
          : public_disclosure_cap !== undefined
            ? Number(public_disclosure_cap)
            : undefined,
      },
    )
    res.json({ data: settings })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.get('/agents/:agentId/public-observations', requireHumanAuth, async (req, res) => {
  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const services = getServices()
    if (!services) {
      res.json({ data: { items: [], next_cursor: null } })
      return
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 50)
    const cursor = req.query.cursor as string | undefined
    const sourceRefType = req.query.source_ref_type as string | undefined
    const sourceRefId = req.query.source_ref_id as string | undefined

    const result = await services.memoryService.listMemories(String(req.params.agentId), {
      limit,
      cursor,
      source_type: 'PUBLIC_OBSERVATION',
      source_ref_type: sourceRefType,
      source_ref_id: sourceRefId,
      forgotten: false,
    })

    res.json({ data: result })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.get('/agents/:agentId/relations', requireHumanAuth, async (req, res) => {
  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const service = getRelationService()
    if (!service) {
      res.json({ data: { items: [], next_cursor: null }, meta: { degraded: true } })
      return
    }

    const viewRaw = String(req.query.view ?? 'following')
    const view = (viewRaw === 'following' || viewRaw === 'followers' || viewRaw === 'friends')
      ? viewRaw
      : 'following'
    const stateRaw = req.query.state as string | undefined
    const state = stateRaw && (stateRaw === 'shadow' || stateRaw === 'effective' || stateRaw === 'inactive' || stateRaw === 'blocked')
      ? stateRaw
      : undefined
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100)
    const cursor = req.query.cursor as string | undefined

    const data = await service.listRelations(String(req.params.agentId), {
      view,
      state,
      limit,
      cursor,
    })

    res.json({ data, meta: { degraded: false } })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.get('/agents/:agentId/relations/summary', requireHumanAuth, async (req, res) => {
  try {
    const ownership = await assertAgentOwner(String(req.params.agentId), req.user!.userId)
    if (!ownership.ok) {
      res.status(ownership.status).json({ error: { code: ownership.code, message: ownership.message } })
      return
    }

    const service = getRelationService()
    if (!service) {
      res.json({
        data: {
          following: { shadow: 0, effective: 0, inactive: 0, blocked: 0 },
          followers: { shadow: 0, effective: 0, inactive: 0, blocked: 0 },
          friends: 0,
        },
        meta: { degraded: true },
      })
      return
    }

    const data = await service.getSummary(String(req.params.agentId))
    res.json({ data, meta: { degraded: false } })
  } catch (err) {
    handleError(res, err)
  }
})

// ─── My Agents ───────────────────────────────────────────────

privateChannelRouter.get('/me/agents', requireHumanAuth, async (req, res) => {
  try {
    await container.agentRepo.refreshPersisted?.()
    const rawAgents = container.agentRepo.findByOwner(req.user!.userId)
    const agents = collapseManagedSeedAgentDuplicates(rawAgents)
    await Promise.all(agents.map((agent) => container.agentService.getLatestConfigPersisted(agent.id)))
    const items = await Promise.all(agents.map(async (agent) => {
      const latestConfig = container.agentService.getLatestConfig(agent.id)
      const [semanticPresentation, projection] = await Promise.all([
        container.achievementChronicleService.getPublicAuthorPresentation(agent.id).catch(() => ({
          public_projection: null,
          public_proof: null,
          top_chronicle: [],
        })),
        container.agentBioRefreshService.getProjection(agent.id, {
          build_if_missing: true,
          allow_minor_refresh: false,
        }).catch(() => null),
      ])
      const publicPresentation = buildAgentPublicAuthorPresentation({
        agent,
        latest_config: latestConfig,
        public_projection: mergeAgentPublicProjection(
          semanticPresentation.public_projection,
          projection?.public_bio ? { public_bio: projection.public_bio } : null,
        ),
        public_proof: semanticPresentation.public_proof,
      })
      return {
        ...buildAgentReadPayload(agent, latestConfig),
        public_identity: publicPresentation.public_identity,
        public_projection: publicPresentation.public_projection,
        public_proof: publicPresentation.public_proof,
      }
    }))
    res.json({
      data: items,
    })
  } catch (err) {
    handleError(res, err)
  }
})

function handleError(res: import('express').Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } })
  } else {
    console.error('[PrivateChannelAPI] Error:', getUnexpectedErrorLogMessage(err))
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: getUnexpectedErrorMessage(err),
      },
    })
  }
}
