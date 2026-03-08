import { Router, type IRouter } from 'express'
import multer from 'multer'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { agentService, inclinationAssetService } from '../container.js'
import { config } from '../lib/config.js'
import { ForbiddenError, ValidationError } from '../lib/errors.js'
import { ensureDevAuthUserPersisted } from '../lib/dev-auth-user.js'
import { validate } from '../validation/validate.js'
import { buildAgentReadPayload } from '../identity/agent-identity.js'
import {
  createAgentSchema,
  updateAgentConfigSchema,
  updateAgentProfileSchema,
} from '../validation/schemas.js'

export const agentControlRouter: IRouter = Router()

const inclinationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

agentControlRouter.post('/agents', requireHumanAuth, validate(createAgentSchema), async (req, res) => {
  await ensureDevAuthUserPersisted(req.user!)
  const agent = await agentService.createAgentPersisted({
    owner_id: req.user!.userId,
    ...req.body,
  })
  res.status(201).json({
    data: buildAgentReadPayload(agent, agentService.getLatestConfig(agent.id)),
  })
})

agentControlRouter.patch(
  '/agents/:agentId/profile',
  requireHumanAuth,
  validate(updateAgentProfileSchema),
  (req, res) => {
    const agentId = String(req.params.agentId)
    const actor = req.user!
    const existing = agentService.getAgent(agentId)
    const isAllowed = actor.role === 'admin' || existing.owner_id === actor.userId
    if (!isAllowed) {
      throw new ForbiddenError('Only owner or admin can update agent profile')
    }

    const updated = agentService.updateProfile({
      agent_id: agentId,
      display_name: req.body.display_name,
      avatar_url: req.body.avatar_url,
    })
    res.json({
      data: buildAgentReadPayload(updated, agentService.getLatestConfig(agentId)),
    })
  },
)

agentControlRouter.patch(
  '/agents/:agentId/config',
  requireHumanAuth,
  validate(updateAgentConfigSchema),
  async (req, res) => {
    const agentId = String(req.params.agentId)
    const config = await agentService.updateConfig(
      agentId,
      req.body.config_json,
      req.user!.userId,
    )
    res.json({ data: config })
  },
)

agentControlRouter.post('/agents/:agentId/inclination-asset/url', requireHumanAuth, async (req, res) => {
  if (!config.features.multimodalAgentInclinationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Multimodal agent inclination is disabled by feature flag.' },
    })
    return
  }

  const source_url = String(req.body?.source_url ?? '').trim()
  const owner_note = typeof req.body?.owner_note === 'string' ? req.body.owner_note : undefined
  if (!source_url) {
    throw new ValidationError('source_url is required')
  }

  const data = await inclinationAssetService.createFromUrl({
    agent_id: String(req.params.agentId),
    owner_user_id: req.user!.userId,
    source_url,
    owner_note,
  })

  res.status(201).json({ data })
})

agentControlRouter.post('/agents/:agentId/inclination-asset/upload', requireHumanAuth, async (req, res, next) => {
  if (!config.features.multimodalAgentInclinationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Multimodal agent inclination is disabled by feature flag.' },
    })
    return
  }

  inclinationUpload.single('file')(req, res, async (err) => {
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

      const ownerNoteRaw = (req.body as Record<string, unknown> | undefined)?.owner_note
      const owner_note = typeof ownerNoteRaw === 'string' ? ownerNoteRaw : undefined

      const data = await inclinationAssetService.createFromUpload({
        agent_id: String(req.params.agentId),
        owner_user_id: req.user!.userId,
        owner_note,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        bytes: req.file.buffer,
      })

      res.status(201).json({ data })
    } catch (uploadErr) {
      next(uploadErr)
    }
  })
})

agentControlRouter.get('/agents/:agentId/inclination-asset/current', requireHumanAuth, (req, res) => {
  if (!config.features.multimodalAgentInclinationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Multimodal agent inclination is disabled by feature flag.' },
    })
    return
  }
  const data = inclinationAssetService.getCurrent(String(req.params.agentId), req.user!.userId)
  res.json({ data })
})

agentControlRouter.delete('/agents/:agentId/inclination-asset/current', requireHumanAuth, (req, res) => {
  if (!config.features.multimodalAgentInclinationV1) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Multimodal agent inclination is disabled by feature flag.' },
    })
    return
  }
  const data = inclinationAssetService.cancelCurrent(String(req.params.agentId), req.user!.userId)
  res.json({ data })
})

agentControlRouter.get(
  '/agents/:agentId/runs',
  requireHumanAuth,
  (req, res) => {
    const agentId = String(req.params.agentId)
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const limitStr = typeof req.query.limit === 'string' ? req.query.limit : undefined
    const result = agentService.getAgentRuns(agentId, {
      cursor,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
    })
    res.json({ data: result.items, meta: { cursor: result.next_cursor } })
  },
)
