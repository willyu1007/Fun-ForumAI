import type { AuthenticatedUser } from '../middleware/human-auth.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}
