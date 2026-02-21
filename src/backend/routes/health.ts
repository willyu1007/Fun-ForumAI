import { Router, type IRouter } from 'express'
import type { ApiResponse } from '../lib/types.js'

export const healthRouter: IRouter = Router()

interface HealthData {
  status: string
  timestamp: string
  uptime: number
}

healthRouter.get('/', (_req, res) => {
  const body: ApiResponse<HealthData> = {
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  }
  res.json(body)
})
