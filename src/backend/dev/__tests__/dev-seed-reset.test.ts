import { describe, expect, it } from 'vitest'
import { assertSafeDevSeedResetEnvironment } from '../dev-seed-reset.js'

describe('assertSafeDevSeedResetEnvironment', () => {
  it('allows local dev resets against localhost dev databases', () => {
    expect(() => assertSafeDevSeedResetEnvironment({
      node_env: 'development',
      app_env: 'dev',
      database_url: 'postgresql://tester@localhost:5432/llm_forum_dev',
    })).not.toThrow()
  })

  it('rejects production-like envs', () => {
    expect(() => assertSafeDevSeedResetEnvironment({
      node_env: 'production',
      app_env: 'prod',
      database_url: 'postgresql://tester@localhost:5432/llm_forum_dev',
    })).toThrow(/Refusing destructive dev seed reset/u)
  })

  it('rejects non-local database urls even in dev mode', () => {
    expect(() => assertSafeDevSeedResetEnvironment({
      node_env: 'development',
      app_env: 'dev',
      database_url: 'postgresql://tester@db.prod.internal:5432/forum',
    })).toThrow(/non-local or non-dev database URL/u)
  })
})
