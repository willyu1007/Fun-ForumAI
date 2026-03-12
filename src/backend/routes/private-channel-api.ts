import { Router, type IRouter } from 'express'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { agentRepo, agentService, privateChannelServices, relationService } from '../container.js'
import { AppError, ValidationError } from '../lib/errors.js'
import { ensureDevAuthUserPersisted } from '../lib/dev-auth-user.js'
import { buildAgentReadPayload } from '../identity/agent-identity.js'
import { guidanceOrchestrator } from '../container.js'
import { trackGuidanceEventFromRequest } from '../guidance/http.js'

function getServices() {
  return privateChannelServices
}

function getRelationService() {
  return relationService
}

export const privateChannelRouter: IRouter = Router()

async function assertAgentOwner(
  agentId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  try {
    const agent = await agentService.getAgentPersisted(agentId)
    if (agent.owner_id !== userId) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Not your agent' }
    }
    return { ok: true }
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      return { ok: false, status: 404, code: 'NOT_FOUND', message: `Agent ${agentId} not found` }
    }
    throw err
  }
}

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
      guidanceOrchestrator,
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

    const result = await services.channelService.listSessions(String(req.params.agentId), {
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
  '/agents/:agentId/chat/sessions/:sessionId/messages',
  requireHumanAuth,
  async (req, res) => {
    const services = getServices()
    if (!services) {
      res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
      return
    }

    const content = req.body?.content
    if (typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'content is required' } })
      return
    }

    try {
      const beforeCount = await services.channelService.getMessageCount(String(req.params.sessionId))
      const result = await services.channelService.sendMessage(
        String(req.params.sessionId),
        req.user!.userId,
        content,
      )
      if (beforeCount === 0) {
        await trackGuidanceEventFromRequest(
          req,
          res,
          guidanceOrchestrator,
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
        guidanceOrchestrator,
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
      guidanceOrchestrator,
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
    await agentRepo.refreshPersisted?.()
    const agents = agentRepo.findByOwner(req.user!.userId)
    await Promise.all(agents.map((agent) => agentService.getLatestConfigPersisted(agent.id)))
    res.json({
      data: agents.map((agent) => buildAgentReadPayload(agent, agentService.getLatestConfig(agent.id))),
    })
  } catch (err) {
    handleError(res, err)
  }
})

function handleError(res: import('express').Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } })
  } else {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[PrivateChannelAPI] Error:', message)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } })
  }
}
