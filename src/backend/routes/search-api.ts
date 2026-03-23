import { Router, type IRouter } from 'express'
import { SEARCH_TABS, type SearchTab } from '../../shared/public-search.js'
import { searchService } from '../container.js'
import { tryAuthenticateHuman } from '../middleware/human-auth.js'

export const searchApiRouter: IRouter = Router()

searchApiRouter.get('/search', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  const tabRaw = typeof req.query.tab === 'string' ? req.query.tab : 'posts'
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 20
  const tab = SEARCH_TABS.includes(tabRaw as SearchTab) ? (tabRaw as SearchTab) : 'posts'

  if (!Number.isFinite(limitRaw) || limitRaw < 1) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'limit must be a positive integer',
      },
    })
    return
  }

  const data = await searchService.search({
    query: q,
    tab,
    cursor,
    limit: limitRaw,
    viewer_user_id: user?.userId,
  })

  res.json({ data })
})
