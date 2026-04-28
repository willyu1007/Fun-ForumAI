import { afterEach, describe, expect, it, vi } from 'vitest'

const ENV_SNAPSHOT = { ...process.env }

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ENV_SNAPSHOT)) {
      delete process.env[key]
    }
  }
  Object.assign(process.env, ENV_SNAPSHOT)
}

async function loadConfig(overrides: Record<string, string | undefined>) {
  restoreEnv()
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  vi.resetModules()
  return import('./config.js')
}

describe('config', () => {
  afterEach(() => {
    restoreEnv()
    vi.resetModules()
  })

  it('fails fast when a production-like deployment is missing JWT_SECRET', async () => {
    await expect(loadConfig({
      NODE_ENV: 'production',
      APP_ENV: undefined,
      JWT_SECRET: undefined,
      SERVICE_AUTH_SECRET: 'service-secret',
    })).rejects.toThrow('JWT_SECRET')
  })

  it('fails fast when NODE_ENV=production even if APP_ENV is mis-set to dev', async () => {
    await expect(loadConfig({
      NODE_ENV: 'production',
      APP_ENV: 'dev',
      JWT_SECRET: undefined,
      SERVICE_AUTH_SECRET: 'service-secret',
    })).rejects.toThrow('NODE_ENV=production')
  })

  it('derives prod mode from NODE_ENV and disables dev-only surfaces', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'production',
      APP_ENV: undefined,
      JWT_SECRET: 'prod-jwt-secret',
      SERVICE_AUTH_SECRET: 'prod-service-secret',
    })

    expect(config.appEnv).toBe('prod')
    expect(config.allowDevTools).toBe(false)
    expect(config.secureCookies).toBe(true)
  })

  it('keeps dev-only surfaces disabled when NODE_ENV=production even if APP_ENV=dev', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'production',
      APP_ENV: 'dev',
      JWT_SECRET: 'prod-jwt-secret',
      SERVICE_AUTH_SECRET: 'prod-service-secret',
    })

    expect(config.appEnv).toBe('dev')
    expect(config.allowDevTools).toBe(false)
    expect(config.secureCookies).toBe(true)
  })

  it('uses relaxed default timeouts for media generation flows', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      MEDIA_GENERATION_TIMEOUT_MS: undefined,
      MEDIA_GENERATION_RUNNING_TIMEOUT_MS: undefined,
    })

    expect(config.mediaGeneration.timeoutMs).toBe(180_000)
    expect(config.mediaGeneration.runningTimeoutMs).toBe(360_000)
  })

  it('reads agent stats feature flags from env', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      FF_AGENT_STATS_V1: 'true',
      FF_AGENT_STATS_BEHAVIOR: 'true',
      FF_AGENT_STATS_RELATION_POLICY: 'false',
      FF_AGENT_STATS_VOTE_POLICY: 'true',
      FF_AGENT_STATS_UI: 'true',
    })

    expect(config.launch.capabilities.agentStatsV1).toBe(true)
    expect(config.launch.capabilities.agentStatsBehavior).toBe(true)
    expect(config.launch.capabilities.agentStatsRelationPolicy).toBe(false)
    expect(config.launch.capabilities.agentStatsVotePolicy).toBe(true)
    expect(config.launch.capabilities.agentStatsUi).toBe(true)
  })

  it('defaults agent stats v1 to enabled when env is unset', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      FF_AGENT_STATS_V1: undefined,
    })

    expect(config.launch.capabilities.agentStatsV1).toBe(true)
  })

  it('reads launch programming flags from env defaults and overrides', async () => {
    const defaults = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      FF_HOME_PROGRAMMING_V1: undefined,
      FF_PROGRAMMING_OPS_V1: undefined,
      FF_GLOBAL_HIGHLIGHTS_V1: undefined,
    })

    expect(defaults.config.launch.capabilities.homeProgrammingV1).toBe(false)
    expect(defaults.config.launch.capabilities.programmingOpsV1).toBe(false)
    expect(defaults.config.launch.capabilities.globalHighlightsV1).toBe(true)

    const enabled = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      FF_HOME_PROGRAMMING_V1: 'true',
      FF_PROGRAMMING_OPS_V1: 'true',
      FF_GLOBAL_HIGHLIGHTS_V1: 'false',
    })

    expect(enabled.config.launch.capabilities.homeProgrammingV1).toBe(true)
    expect(enabled.config.launch.capabilities.programmingOpsV1).toBe(true)
    expect(enabled.config.launch.capabilities.globalHighlightsV1).toBe(false)
  })

  it('can disable the home programming snapshot scheduler independently', async () => {
    const { config } = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      RUNTIME_HOME_PROGRAMMING_SNAPSHOT_SCHEDULER_ENABLED: 'false',
    })

    expect(config.runtime.homeProgrammingSnapshotSchedulerEnabled).toBe(false)
  })

  it('reads achievement and observation feature flags from env defaults and overrides', async () => {
    const defaults = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      FF_ACHIEVEMENT_CHRONICLE_V1: undefined,
      FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS: undefined,
      FF_PUBLIC_OBSERVATION_MEMORY: undefined,
    })

    expect(defaults.config.launch.capabilities.achievementChronicleV1).toBe(false)
    expect(defaults.config.launch.capabilities.achievementPublicHighlights).toBe(false)
    expect(defaults.config.launch.capabilities.publicObservationMemory).toBe(false)

    const enabled = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      FF_ACHIEVEMENT_CHRONICLE_V1: 'true',
      FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS: 'true',
      FF_PUBLIC_OBSERVATION_MEMORY: 'true',
    })

    expect(enabled.config.launch.capabilities.achievementChronicleV1).toBe(true)
    expect(enabled.config.launch.capabilities.achievementPublicHighlights).toBe(true)
    expect(enabled.config.launch.capabilities.publicObservationMemory).toBe(true)
  })

  it('reads media feature flags from env defaults and overrides', async () => {
    const defaults = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      FF_MULTIMODAL_AGENT_MEDIA_V1: undefined,
      FF_MEDIA_GENERATION_V1: undefined,
      FF_MEDIA_OBSERVABILITY_V1: undefined,
      FF_MEDIA_ROLLOUT_CONTROLLER_V1: undefined,
      FF_MEDIA_LIFECYCLE_V1: undefined,
    })

    expect(defaults.config.launch.capabilities.multimodalAgentMediaV1).toBe(false)
    expect(defaults.config.launch.capabilities.mediaGenerationV1).toBe(false)
    expect(defaults.config.launch.capabilities.mediaObservabilityV1).toBe(false)
    expect(defaults.config.launch.capabilities.mediaRolloutControllerV1).toBe(false)
    expect(defaults.config.launch.capabilities.mediaLifecycleV1).toBe(false)

    const enabled = await loadConfig({
      NODE_ENV: 'development',
      APP_ENV: 'dev',
      JWT_SECRET: 'dev-jwt-secret',
      SERVICE_AUTH_SECRET: 'dev-service-secret',
      FF_MULTIMODAL_AGENT_MEDIA_V1: 'true',
      FF_MEDIA_GENERATION_V1: 'true',
      FF_MEDIA_OBSERVABILITY_V1: 'true',
      FF_MEDIA_ROLLOUT_CONTROLLER_V1: 'true',
      FF_MEDIA_LIFECYCLE_V1: 'true',
    })

    expect(enabled.config.launch.capabilities.multimodalAgentMediaV1).toBe(true)
    expect(enabled.config.launch.capabilities.mediaGenerationV1).toBe(true)
    expect(enabled.config.launch.capabilities.mediaObservabilityV1).toBe(true)
    expect(enabled.config.launch.capabilities.mediaRolloutControllerV1).toBe(true)
    expect(enabled.config.launch.capabilities.mediaLifecycleV1).toBe(true)
  })
})
