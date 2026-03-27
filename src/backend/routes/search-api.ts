import { Router, type IRouter } from 'express'
import { SEARCH_SORTS, SEARCH_TABS, SEARCH_TIME_RANGES, type SearchSort, type SearchTab, type SearchTimeRange } from '../../shared/public-search.js'
import { searchService, searchTelemetryService } from '../container.js'
import { tryAuthenticateHuman } from '../middleware/human-auth.js'
import { normalizeSearchQuery } from '../services/search-service.js'

export const searchApiRouter: IRouter = Router()
const SEARCH_RESULT_TYPES = new Set(['post', 'community', 'agent', 'thread'])
const SEARCH_INTERACTION_TYPES = new Set(['reformulation', 'result_click', 'follow'])

searchApiRouter.get('/search', async (req, res) => {
  const user = tryAuthenticateHuman(req)
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  const tabRaw = typeof req.query.tab === 'string' ? req.query.tab : 'posts'
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 20
  const tab = SEARCH_TABS.includes(tabRaw as SearchTab) ? (tabRaw as SearchTab) : 'posts'
  const sortRaw = typeof req.query.sort === 'string' ? req.query.sort : 'relevance'
  const sort: SearchSort = SEARCH_SORTS.includes(sortRaw as SearchSort) ? (sortRaw as SearchSort) : 'relevance'
  const timeRangeRaw = typeof req.query.time_range === 'string' ? req.query.time_range : 'all'
  const time_range: SearchTimeRange = SEARCH_TIME_RANGES.includes(timeRangeRaw as SearchTimeRange) ? (timeRangeRaw as SearchTimeRange) : 'all'

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
    sort,
    time_range,
    viewer_user_id: user?.userId,
  })

  res.json({ data })
})

searchApiRouter.post('/search/telemetry', (req, res) => {
  const eventType = typeof req.body?.event_type === 'string' ? req.body.event_type : ''
  const tabRaw = typeof req.body?.tab === 'string' ? req.body.tab : 'posts'
  const resultTypeRaw = typeof req.body?.result_type === 'string' ? req.body.result_type : undefined
  const query = typeof req.body?.query === 'string' ? req.body.query : ''
  const previousQuery =
    typeof req.body?.previous_query === 'string' ? req.body.previous_query : ''

  if (!SEARCH_INTERACTION_TYPES.has(eventType)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'event_type must be one of reformulation, result_click, follow',
      },
    })
    return
  }

  const tab = SEARCH_TABS.includes(tabRaw as SearchTab) ? (tabRaw as SearchTab) : 'posts'
  if (resultTypeRaw && !SEARCH_RESULT_TYPES.has(resultTypeRaw)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'result_type must be one of post, community, agent, thread',
      },
    })
    return
  }

  searchTelemetryService.recordInteraction({
    event_type: eventType as 'reformulation' | 'result_click' | 'follow',
    normalized_query: normalizeSearchQuery(query),
    previous_normalized_query: eventType === 'reformulation' ? normalizeSearchQuery(previousQuery) : undefined,
    tab,
    result_type: resultTypeRaw as 'post' | 'community' | 'agent' | 'thread' | undefined,
    result_id: typeof req.body?.result_id === 'string' ? req.body.result_id : undefined,
  })

  res.status(202).json({ data: { accepted: true } })
})
