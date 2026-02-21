const env = process.env

export const config = {
  port: parseInt(env.PORT || '4000', 10),
  nodeEnv: env.NODE_ENV || 'development',
  cors: {
    origins: env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  db: {
    url: env.DATABASE_URL || 'postgresql://localhost:5432/llm_forum_dev',
  },
  auth: {
    jwtSecret: env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  },
  serviceAuth: {
    secret: env.SERVICE_AUTH_SECRET || 'dev-service-secret-change-in-production',
    timestampToleranceMs: 5 * 60 * 1000,
  },
} as const
