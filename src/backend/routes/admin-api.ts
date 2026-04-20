import { Router, type IRouter } from 'express'
import { registerAdminHotTopicRoutes } from './admin/admin-hot-topic-routes.js'
import { registerAdminKickoffRoutes } from './admin/admin-kickoff-routes.js'
import { registerAdminMediaRoutes } from './admin/admin-media-routes.js'
import { registerAdminReviewRoutes } from './admin/admin-review-routes.js'
import { registerAdminRiskRoutes } from './admin/admin-risk-routes.js'
import { registerAdminRuntimeRoutes } from './admin/admin-runtime-routes.js'

export const adminApiRouter: IRouter = Router()

registerAdminReviewRoutes(adminApiRouter)
registerAdminRuntimeRoutes(adminApiRouter)
registerAdminRiskRoutes(adminApiRouter)
registerAdminMediaRoutes(adminApiRouter)
registerAdminHotTopicRoutes(adminApiRouter)
registerAdminKickoffRoutes(adminApiRouter)
