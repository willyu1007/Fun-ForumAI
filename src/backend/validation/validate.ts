import type { Request, Response, NextFunction } from 'express'
import { type ZodType, ZodError } from 'zod'

type Target = 'body' | 'query' | 'params'

export function validate(schema: ZodType, target: Target = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[target])
      if (target === 'body') {
        req.body = parsed
      }
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: err.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        })
        return
      }
      next(err)
    }
  }
}
