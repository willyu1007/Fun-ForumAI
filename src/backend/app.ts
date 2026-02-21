import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { config } from './lib/config.js'
import { apiRouter } from './routes/index.js'
import { healthRouter } from './routes/health.js'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'

const app: Express = express()

app.use(helmet())
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
)
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(requestLogger)

app.use('/health', healthRouter)
app.use('/v1', apiRouter)

app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  })
})

app.use(errorHandler)

export { app }
