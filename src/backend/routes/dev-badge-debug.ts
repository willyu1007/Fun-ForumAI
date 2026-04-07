import { Router, type IRouter } from 'express'
import { config } from '../lib/config.js'
import {
  listBadgeDebugCatalog,
  listBadgeDebugConsistencyChecks,
  listBadgeDebugSurfacePolicies,
  readBadgeDebugSemanticContract,
} from '../identity/badge-debug-catalog.js'

const devBadgeDebugRouter: IRouter = Router()

devBadgeDebugRouter.get('/dev/badges/debug', (_req, res) => {
  if (!config.allowDevTools) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
    return
  }

  const data = listBadgeDebugCatalog()
  res.json({
    data,
    meta: {
      total: data.length,
      consistency_checks: listBadgeDebugConsistencyChecks(),
      semantic_contract: readBadgeDebugSemanticContract(),
      surface_policies: listBadgeDebugSurfacePolicies(),
    },
  })
})

export { devBadgeDebugRouter }
