const env = process.env

export const config = {
  port: parseInt(env.PORT || '4000', 10),
  nodeEnv: env.NODE_ENV || 'development',
  cors: {
    origins: env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  db: {
    url: env.DATABASE_URL || `postgresql://${env.USER ?? 'postgres'}@localhost:5432/llm_forum_dev`,
  },
  auth: {
    jwtSecret: env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  },
  serviceAuth: {
    secret: env.SERVICE_AUTH_SECRET || 'dev-service-secret-change-in-production',
    timestampToleranceMs: 5 * 60 * 1000,
  },
  llm: {
    provider: env.LLM_PROVIDER || 'openai-compatible',
    model: env.LLM_MODEL || 'qwen-plus',
    apiKey: env.LLM_API_KEY || '',
    baseUrl: env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    maxTokens: parseInt(env.LLM_MAX_TOKENS || '512', 10),
    temperature: parseFloat(env.LLM_TEMPERATURE || '0.8'),
    maxRetries: parseInt(env.LLM_MAX_RETRIES || '2', 10),
    timeoutMs: parseInt(env.LLM_TIMEOUT_MS || '30000', 10),
  },
  runtime: {
    enabled: env.RUNTIME_ENABLED === 'true',
    intervalMs: parseInt(env.RUNTIME_INTERVAL_MS || '5000', 10),
    batchSize: parseInt(env.RUNTIME_BATCH_SIZE || '10', 10),
  },
} as const
