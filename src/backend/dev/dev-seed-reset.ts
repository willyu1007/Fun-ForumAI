function parseAppEnv(raw: string | undefined, nodeEnv: string | undefined): 'dev' | 'staging' | 'prod' {
  if (raw === 'dev' || raw === 'staging' || raw === 'prod') return raw
  return nodeEnv === 'production' ? 'prod' : 'dev'
}

function isLoopbackHost(hostname: string | null): boolean {
  if (!hostname) return false
  const normalized = hostname.toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

function databaseLooksLocal(rawDatabaseUrl: string | undefined): boolean {
  if (!rawDatabaseUrl) return true
  try {
    const parsed = new URL(rawDatabaseUrl)
    const dbName = parsed.pathname.replace(/^\//, '').toLowerCase()
    return isLoopbackHost(parsed.hostname) || /(dev|test|local)/.test(dbName)
  } catch {
    return false
  }
}

export function assertSafeDevSeedResetEnvironment(input: {
  node_env?: string
  app_env?: string
  database_url?: string
}): void {
  const nodeEnv = input.node_env ?? process.env.NODE_ENV
  const appEnv = parseAppEnv(input.app_env ?? process.env.APP_ENV, nodeEnv)
  if (nodeEnv === 'production' || appEnv !== 'dev') {
    throw new Error(`Refusing destructive dev seed reset outside local dev mode (NODE_ENV=${nodeEnv ?? 'unset'}, APP_ENV=${appEnv}).`)
  }
  if (!databaseLooksLocal(input.database_url ?? process.env.DATABASE_URL)) {
    throw new Error('Refusing destructive dev seed reset against a non-local or non-dev database URL.')
  }
}
