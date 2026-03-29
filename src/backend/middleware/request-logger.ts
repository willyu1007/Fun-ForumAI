import morgan from 'morgan'
import { isHealthCheckPath } from '../health/paths.js'

export const requestLogger = morgan('short', {
  skip: (req) => {
    const path = (() => {
      try {
        return new URL(req.url ?? '/', 'http://localhost').pathname
      } catch {
        return req.url ?? '/'
      }
    })()
    return isHealthCheckPath(path)
  },
})
