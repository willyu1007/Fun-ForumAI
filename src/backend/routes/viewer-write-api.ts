import { Router, type IRouter } from 'express'
import { requireHumanAuth } from '../middleware/human-auth.js'
import { validate } from '../validation/validate.js'
import {
  createAudienceMessageSchema,
  createPublicThreadSchema,
  createPublicTurnSchema,
} from '../validation/schemas.js'
import {
  executeViewerAudienceMessageDelete,
  executeViewerAudienceMessageLikeToggle,
  executeViewerAudienceMessageWrite,
  executeViewerPublicThreadWrite,
  executeViewerPublicTurnWrite,
  getViewerWriteStatus,
} from './viewer-write-shared.js'

export const viewerWriteApiRouter: IRouter = Router()

// Canonical viewer-facing public write plane. Frontend and active docs bind
// here directly; no legacy public-write aliases remain.
viewerWriteApiRouter.post(
  '/viewer/posts/:postId/public-threads',
  requireHumanAuth,
  validate(createPublicThreadSchema),
  async (req, res) => {
    const result = await executeViewerPublicThreadWrite(req)
    res.status(getViewerWriteStatus(result)).json({ data: result })
  },
)

viewerWriteApiRouter.post(
  '/viewer/threads/:threadId/public-turns',
  requireHumanAuth,
  validate(createPublicTurnSchema),
  async (req, res) => {
    const result = await executeViewerPublicTurnWrite(req)
    res.status(getViewerWriteStatus(result)).json({ data: result })
  },
)

viewerWriteApiRouter.post(
  '/viewer/posts/:postId/audience-messages',
  requireHumanAuth,
  validate(createAudienceMessageSchema),
  async (req, res) => {
    const result = await executeViewerAudienceMessageWrite(req)
    res.status(getViewerWriteStatus(result)).json({ data: result })
  },
)

viewerWriteApiRouter.delete(
  '/viewer/audience-messages/:messageId',
  requireHumanAuth,
  async (req, res) => {
    const result = await executeViewerAudienceMessageDelete(req)
    res.status(200).json({ data: result })
  },
)

viewerWriteApiRouter.post(
  '/viewer/audience-messages/:messageId/likes',
  requireHumanAuth,
  async (req, res) => {
    const result = await executeViewerAudienceMessageLikeToggle(req, true)
    res.status(200).json({ data: result })
  },
)

viewerWriteApiRouter.delete(
  '/viewer/audience-messages/:messageId/likes',
  requireHumanAuth,
  async (req, res) => {
    const result = await executeViewerAudienceMessageLikeToggle(req, false)
    res.status(200).json({ data: result })
  },
)
