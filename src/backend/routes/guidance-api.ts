import { Router, type IRouter } from 'express'
import { guidanceOrchestrator } from '../container.js'
import { resolveGuidanceActorContext } from '../guidance/http.js'
import { toGuidanceItemCardView } from '../guidance/guidance-types.js'
import { ValidationError } from '../lib/errors.js'

export const guidanceRouter: IRouter = Router()

guidanceRouter.get('/guidance/summary', async (req, res, next) => {
  try {
    const actor = resolveGuidanceActorContext(req, res)
    await guidanceOrchestrator.prepareActor(actor)
    const data = await guidanceOrchestrator.getSummary(actor)
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

guidanceRouter.get('/guidance/inbox', async (req, res, next) => {
  try {
    const actor = resolveGuidanceActorContext(req, res)
    await guidanceOrchestrator.prepareActor(actor)
    const data = await guidanceOrchestrator.getInbox(actor)
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

guidanceRouter.post('/guidance/client-events', async (req, res, next) => {
  try {
    const eventType = typeof req.body?.event_type === 'string' ? req.body.event_type : null
    if (!eventType) {
      throw new ValidationError('event_type is required')
    }

    const actor = resolveGuidanceActorContext(req, res)
    await guidanceOrchestrator.prepareActor(actor)
    await guidanceOrchestrator.ingestEvent(
      actor,
      eventType,
      req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload as Record<string, unknown> : {},
      {
        dedup_key: typeof req.body?.dedup_key === 'string' ? req.body.dedup_key : undefined,
      },
    )
    res.status(202).json({ data: { accepted: true } })
  } catch (err) {
    next(err)
  }
})

guidanceRouter.post('/guidance/items/:id/action', async (req, res, next) => {
  try {
    const action = typeof req.body?.action === 'string' ? req.body.action : null
    if (action !== 'open' && action !== 'dismiss' && action !== 'complete') {
      throw new ValidationError('action must be one of open, dismiss, complete')
    }
    const actor = resolveGuidanceActorContext(req, res)
    await guidanceOrchestrator.prepareActor(actor)
    const item = await guidanceOrchestrator.actOnItem(actor, String(req.params.id), action)
    if (!item) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Guidance item not found' } })
      return
    }
    res.json({ data: toGuidanceItemCardView(item) })
  } catch (err) {
    next(err)
  }
})
