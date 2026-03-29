const HEALTH_CHECK_PATHS = new Set([
  '/health',
  '/livez',
  '/readyz',
  '/v1/health',
  '/v1/livez',
  '/v1/readyz',
])

export function isHealthCheckPath(path: string): boolean {
  const normalizedPath = normalizeHealthCheckPath(path)
  return HEALTH_CHECK_PATHS.has(normalizedPath)
}

function normalizeHealthCheckPath(path: string): string {
  if (path.length <= 1) return path
  return path.endsWith('/') ? path.slice(0, -1) : path
}
