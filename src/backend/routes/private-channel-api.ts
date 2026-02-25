import { Router, type IRouter } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { PrivateChannelService } from '../services/private-channel-service.js'
import { MemoryService } from '../services/memory-service.js'
import { PgPrivateChannelRepository } from '../repos/pg/pg-private-channel-repository.js'
import { PgMemoryRepository } from '../repos/pg/pg-memory-repository.js'
import { agentService, llmClient, growthEngine } from '../container.js'
import { AppError, ValidationError } from '../lib/errors.js'

function getPrismaOrNull(): PrismaClient | null {
  return ((globalThis as Record<string, unknown>).__forumPrisma as PrismaClient) ?? null
}

let _services: {
  channelService: PrivateChannelService
  memoryService: MemoryService
} | null = null

function getServices() {
  if (_services) return _services

  const prisma = getPrismaOrNull()
  if (!prisma) return null

  const channelRepo = new PgPrivateChannelRepository(prisma)
  const memoryRepo = new PgMemoryRepository(prisma)

  const memoryService = new MemoryService({
    memoryRepo,
    channelRepo,
    llmClient,
    growthEngine,
  })

  const channelService = new PrivateChannelService({
    channelRepo,
    memoryRepo,
    agentService,
    llmClient,
  })

  _services = { channelService, memoryService }
  return _services
}

export const privateChannelRouter: IRouter = Router()

privateChannelRouter.use(requireHumanAuth)

// ─── Session endpoints ──────────────────────────────────────

privateChannelRouter.post('/agents/:agentId/chat/sessions', async (req, res) => {
  const services = getServices()
  if (!services) {
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
    return
  }

  try {
    const session = await services.channelService.createSession(
      req.params.agentId,
      req.user!.userId,
    )
    res.status(201).json({ data: session })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.get('/agents/:agentId/chat/sessions', async (req, res) => {
  const services = getServices()
  if (!services) {
    res.json({ data: { items: [], next_cursor: null } })
    return
  }

  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 50)
    const cursor = req.query.cursor as string | undefined
    const status = req.query.status as string | undefined

    const result = await services.channelService.listSessions(req.params.agentId, {
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
      const result = await services.channelService.sendMessage(
        req.params.sessionId,
        req.user!.userId,
        content,
      )
      res.json({ data: result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

privateChannelRouter.get(
  '/agents/:agentId/chat/sessions/:sessionId/messages',
  async (req, res) => {
    const services = getServices()
    if (!services) {
      res.json({ data: { items: [], next_cursor: null } })
      return
    }

    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 100)
      const cursor = req.query.cursor as string | undefined
      const result = await services.channelService.getMessages(req.params.sessionId, {
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
  async (req, res) => {
    const services = getServices()
    if (!services) {
      res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
      return
    }

    try {
      const session = await services.channelService.endSession(
        req.params.sessionId,
        req.user!.userId,
      )

      services.memoryService.generateDigest(session.id).catch((err) => {
        console.error('[PrivateChannelAPI] Digest generation failed:', err)
      })

      res.json({ data: { session, digest_status: 'GENERATING' } })
    } catch (err) {
      handleError(res, err)
    }
  },
)

// ─── Memory endpoints ───────────────────────────────────────

privateChannelRouter.get('/agents/:agentId/memories', async (req, res) => {
  const services = getServices()
  if (!services) {
    res.json({ data: { items: [], next_cursor: null } })
    return
  }

  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 50)
    const cursor = req.query.cursor as string | undefined
    const sourceType = req.query.source_type as string | undefined
    const forgotten = req.query.forgotten === 'true' ? true
      : req.query.forgotten === 'false' ? false
      : undefined

    const result = await services.memoryService.listMemories(req.params.agentId, {
      limit,
      cursor,
      source_type: sourceType as 'PRIVATE_CHAT' | 'PUBLIC_OBSERVATION' | 'SYSTEM' | undefined,
      forgotten,
    })
    res.json({ data: result })
  } catch (err) {
    handleError(res, err)
  }
})

// ─── Privacy settings ───────────────────────────────────────

privateChannelRouter.get('/agents/:agentId/privacy-settings', async (req, res) => {
  const services = getServices()
  if (!services) {
    res.json({
      data: {
        agent_id: req.params.agentId,
        disclosure_level: 1,
        public_memory_budget: 1000,
        public_memory_top_k: 4,
      },
    })
    return
  }

  try {
    const settings = await services.memoryService.getPrivacySettings(req.params.agentId)
    res.json({ data: settings })
  } catch (err) {
    handleError(res, err)
  }
})

privateChannelRouter.patch('/agents/:agentId/privacy-settings', async (req, res) => {
  const services = getServices()
  if (!services) {
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database not available' } })
    return
  }

  try {
    const { disclosure_level, public_memory_budget, public_memory_top_k } = req.body ?? {}

    if (disclosure_level !== undefined) {
      const level = Number(disclosure_level)
      if (isNaN(level) || level < 0 || level > 3) {
        throw new ValidationError('disclosure_level must be 0-3')
      }
    }

    const settings = await services.memoryService.updatePrivacySettings(
      req.params.agentId,
      req.user!.userId,
      {
        disclosure_level: disclosure_level !== undefined ? Number(disclosure_level) : undefined,
        public_memory_budget: public_memory_budget !== undefined ? Number(public_memory_budget) : undefined,
        public_memory_top_k: public_memory_top_k !== undefined ? Number(public_memory_top_k) : undefined,
      },
    )
    res.json({ data: settings })
  } catch (err) {
    handleError(res, err)
  }
})

// ─── My Agents ───────────────────────────────────────────────

privateChannelRouter.get('/me/agents', async (req, res) => {
  try {
    const { agentRepo: repo } = await import('../container.js')
    const agents = repo.findByOwner(req.user!.userId)
    res.json({ data: agents })
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
