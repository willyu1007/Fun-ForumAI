import { config } from './config.js'

export const DEFAULT_INTERNAL_ERROR_MESSAGE = 'Internal server error'

export function getUnexpectedErrorMessage(
  err: unknown,
  fallback = DEFAULT_INTERNAL_ERROR_MESSAGE,
): string {
  if (config.allowDevTools && err instanceof Error && err.message.trim().length > 0) {
    return err.message
  }
  return fallback
}

export function getUnexpectedErrorLogMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message
  }
  return String(err)
}
