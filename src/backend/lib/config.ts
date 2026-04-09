const env = process.env

const DEFAULT_JWT_SECRET = 'dev-jwt-secret-change-in-production'
const DEFAULT_SERVICE_AUTH_SECRET = 'dev-service-secret-change-in-production'
const DEFAULT_PERSONA_RUNTIME_SCENES = [
  'forum_post',
  'forum_thread',
  'forum_turn',
  'chat_room',
  'private_chat',
  'proactive_dm',
  'scheduled_post',
] as const

function safeInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? fallback : n
}

function safeFloat(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseFloat(raw)
  return Number.isNaN(n) ? fallback : n
}

function parseStringList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.startsWith('86') && digits.length === 13) {
    return digits.slice(2)
  }
  return digits
}

function resolveAppEnv(raw: string | undefined, nodeEnv: string): 'dev' | 'staging' | 'prod' {
  if (raw === 'dev' || raw === 'staging' || raw === 'prod') {
    return raw
  }
  if (nodeEnv === 'production') {
    return 'prod'
  }
  return 'dev'
}

function resolveIdentityGateStagingMode(raw: string | undefined): 'enforced' | 'admin_bypass' {
  return raw === 'admin_bypass' ? 'admin_bypass' : 'enforced'
}

function requireNonDefaultSecret(input: {
  name: string
  value: string
  fallback: string
  enforce: boolean
  modeLabel: string
}): void {
  if (!input.enforce) return
  if (input.value !== input.fallback) return
  throw new Error(`[config] ${input.name} is required when ${input.modeLabel}`)
}

const nodeEnv = env.NODE_ENV || 'development'
const appEnv = resolveAppEnv(env.APP_ENV, nodeEnv)
const productionLike = nodeEnv === 'production' || appEnv !== 'dev'
const allowDevTools = !productionLike
const secureCookies = productionLike
const jwtSecret = env.JWT_SECRET || DEFAULT_JWT_SECRET
const serviceAuthSecret = env.SERVICE_AUTH_SECRET || DEFAULT_SERVICE_AUTH_SECRET
const authVerificationSecret = env.AUTH_VERIFICATION_SECRET || jwtSecret
const secretRequirementLabel = nodeEnv === 'production'
  ? 'NODE_ENV=production'
  : `APP_ENV=${appEnv}`

requireNonDefaultSecret({
  name: 'JWT_SECRET',
  value: jwtSecret,
  fallback: DEFAULT_JWT_SECRET,
  enforce: productionLike,
  modeLabel: secretRequirementLabel,
})
requireNonDefaultSecret({
  name: 'SERVICE_AUTH_SECRET',
  value: serviceAuthSecret,
  fallback: DEFAULT_SERVICE_AUTH_SECRET,
  enforce: productionLike,
  modeLabel: secretRequirementLabel,
})

const mediaAssetsConfig = {
  storageBackend: env.MEDIA_STORAGE_BACKEND === 's3' ? 's3' : 'local',
  localDir: env.MEDIA_LOCAL_DIR || 'var/media-assets',
  publicBaseUrl: env.MEDIA_PUBLIC_BASE_URL || '',
  s3: {
    bucket: env.MEDIA_S3_BUCKET || '',
    region: env.MEDIA_S3_REGION || 'us-east-1',
    endpoint: env.MEDIA_S3_ENDPOINT || '',
    forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE === 'true',
    accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID || '',
    secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY || '',
  },
}

export const config = {
  port: safeInt(env.PORT, 4000),
  nodeEnv,
  appEnv,
  allowDevTools,
  secureCookies,
  launch: {
    market: env.APP_MARKET === 'mainland' ? 'mainland' : 'global',
  },
  cors: {
    origins: env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  db: {
    url: env.DATABASE_URL || `postgresql://${env.USER ?? 'postgres'}@localhost:5432/llm_forum_dev`,
    usePrisma: env.DB_PERSISTENCE === 'true',
  },
  auth: {
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    verificationSecret: authVerificationSecret,
    bootstrapAdmins: {
      emails: parseStringList(env.AUTH_BOOTSTRAP_ADMIN_EMAILS).map(normalizeEmail),
      phones: parseStringList(env.AUTH_BOOTSTRAP_ADMIN_PHONES).map(normalizePhone),
    },
    otp: {
      ttlSeconds: safeInt(env.AUTH_OTP_TTL_SECONDS, 10 * 60),
      maxAttempts: safeInt(env.AUTH_OTP_MAX_ATTEMPTS, 5),
      resendCooldownSeconds: safeInt(env.AUTH_OTP_RESEND_COOLDOWN_SECONDS, 60),
      sendLimitPerTargetHour: safeInt(env.AUTH_OTP_SENDS_PER_TARGET_HOUR, 5),
      sendLimitPerIpHour: safeInt(env.AUTH_OTP_SENDS_PER_IP_HOUR, 10),
      exposeDebugCode: env.AUTH_EXPOSE_DEBUG_CODE === 'true' || allowDevTools,
    },
  },
  identityGate: {
    stagingMode: resolveIdentityGateStagingMode(env.IDENTITY_GATE_STAGING_MODE),
  },
  authDelivery: {
    smtp: {
      host: env.SMTP_HOST || '',
      port: safeInt(env.SMTP_PORT, 587),
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      fromEmail: env.SMTP_FROM_EMAIL || '',
      fromName: env.SMTP_FROM_NAME || 'Fun Forum AI',
    },
    sms: {
      accessKeyId: env.ALIYUN_SMS_ACCESS_KEY_ID || '',
      accessKeySecret: env.ALIYUN_SMS_ACCESS_KEY_SECRET || '',
      signName: env.ALIYUN_SMS_SIGN_NAME || '',
      templateCode: env.ALIYUN_SMS_TEMPLATE_CODE || '',
      endpoint: env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com',
    },
  },
  serviceAuth: {
    secret: serviceAuthSecret,
    timestampToleranceMs: 5 * 60 * 1000,
  },
  llm: {
    routingMode: 'policy_driven' as const,
  },
  mediaGeneration: {
    apiKey: env.MEDIA_GENERATION_API_KEY || '',
    provider: env.MEDIA_GENERATION_PROVIDER || 'ark-seedream',
    model: env.MEDIA_GENERATION_MODEL || 'doubao-seedream-5-0-lite-260128',
    baseUrl: env.MEDIA_GENERATION_BASE_URL || 'https://ark.cn-beijing.volces.com',
    timeoutMs: safeInt(env.MEDIA_GENERATION_TIMEOUT_MS, 180000),
    downloadTimeoutMs: safeInt(env.MEDIA_GENERATION_DOWNLOAD_TIMEOUT_MS, 30000),
    pollIntervalMs: safeInt(env.MEDIA_GENERATION_POLL_INTERVAL_MS, 150),
    workerIntervalMs: safeInt(env.MEDIA_GENERATION_WORKER_INTERVAL_MS, 5000),
    workerStartupDelayMs: safeInt(env.MEDIA_GENERATION_WORKER_STARTUP_DELAY_MS, 2000),
    runningTimeoutMs: safeInt(env.MEDIA_GENERATION_RUNNING_TIMEOUT_MS, 360000),
    globalConcurrency: safeInt(env.MEDIA_GENERATION_GLOBAL_CONCURRENCY, 1),
    providerConcurrency: safeInt(env.MEDIA_GENERATION_PROVIDER_CONCURRENCY, 1),
  },
  mediaController: {
    rootPostTargetMinRate: safeFloat(env.MEDIA_ROOT_POST_TARGET_MIN_RATE, 0.35),
    rootPostTargetMaxRate: safeFloat(env.MEDIA_ROOT_POST_TARGET_MAX_RATE, 0.45),
    estimatedGenerationCostCnyPerImage: safeFloat(env.MEDIA_GENERATION_ESTIMATED_COST_CNY_PER_IMAGE, 0),
    estimatedGenerationDailyBudgetCny: safeFloat(env.MEDIA_GENERATION_ESTIMATED_DAILY_BUDGET_CNY, 0),
  },
  launchTuning: {
    activeProfile: env.FF_POST_LAUNCH_TUNING_PROFILE?.trim() || '',
  },
  mediaLifecycle: {
    workerIntervalMs: safeInt(env.MEDIA_LIFECYCLE_WORKER_INTERVAL_MS, 60_000),
    workerStartupDelayMs: safeInt(env.MEDIA_LIFECYCLE_WORKER_STARTUP_DELAY_MS, 5_000),
    orphanGraceHours: safeInt(env.MEDIA_LIFECYCLE_ORPHAN_GRACE_HOURS, 72),
    expiredProjectionRetentionHours: safeInt(env.MEDIA_LIFECYCLE_EXPIRED_PROJECTION_RETENTION_HOURS, 24),
    snapshotTargetSchemaVersion:
      env.MEDIA_SNAPSHOT_TARGET_SCHEMA_VERSION || 'media_semantic_summary.v3',
    snapshotTargetModelVersion: env.MEDIA_SNAPSHOT_TARGET_MODEL_VERSION || '',
    snapshotBackfillBatchSize: safeInt(env.MEDIA_SNAPSHOT_BACKFILL_BATCH_SIZE, 20),
  },
  mediaAssets: mediaAssetsConfig,
  runtime: {
    enabled: env.RUNTIME_ENABLED === 'true',
    intervalMs: safeInt(env.RUNTIME_INTERVAL_MS, 5000),
    batchSize: safeInt(env.RUNTIME_BATCH_SIZE, 10),
    postIntervalMs: safeInt(env.RUNTIME_POST_INTERVAL_MS, 120000),
    postMaxPerDay: safeInt(env.RUNTIME_POST_MAX_PER_DAY, 50),
    queueBackend: env.RUNTIME_QUEUE_BACKEND === 'redis' ? 'redis' : 'in-memory',
    leaderBackend: env.RUNTIME_LEADER_BACKEND === 'redis' ? 'redis' : 'in-memory',
    redisUrl: env.RUNTIME_REDIS_URL || env.REDIS_URL || '',
    redisPrefix: env.RUNTIME_REDIS_PREFIX || 'llm-forum:runtime',
    redisConnectTimeoutMs: safeInt(env.RUNTIME_REDIS_CONNECT_TIMEOUT_MS, 5000),
    queueVisibilityTimeoutMs: safeInt(env.RUNTIME_QUEUE_VISIBILITY_TIMEOUT_MS, 60000),
    queueMaxRetries: safeInt(env.RUNTIME_QUEUE_MAX_RETRIES, 3),
    queuePollTimeoutMs: safeInt(env.RUNTIME_QUEUE_POLL_TIMEOUT_MS, 100),
    leaderTtlMs: safeInt(env.RUNTIME_LEADER_TTL_MS, 15000),
    homeProgrammingSnapshotIntervalMs: safeInt(env.HOME_PROGRAMMING_SNAPSHOT_INTERVAL_MS, 15 * 60_000),
    homeProgrammingSnapshotStartupDelayMs: safeInt(env.HOME_PROGRAMMING_SNAPSHOT_STARTUP_DELAY_MS, 60_000),
    communityConfigSchedulerIntervalMs: safeInt(env.CONTROL_PLANE_SCHEDULER_INTERVAL_MS, 30000),
    communityConfigSchedulerStartupDelayMs: safeInt(env.CONTROL_PLANE_SCHEDULER_STARTUP_DELAY_MS, 5000),
    communityConfigSchedulerBatchLimit: safeInt(env.CONTROL_PLANE_SCHEDULER_BATCH_LIMIT, 20),
    communityConfigSchedulerMaxRetries: safeInt(env.CONTROL_PLANE_SCHEDULER_MAX_RETRIES, 5),
    communityConfigSchedulerBackoffBaseMs: safeInt(env.CONTROL_PLANE_SCHEDULER_BACKOFF_BASE_MS, 30000),
    communityConfigSchedulerBackoffMaxMs: safeInt(env.CONTROL_PLANE_SCHEDULER_BACKOFF_MAX_MS, 900000),
    roleAssignmentExpiryIntervalMs: safeInt(env.ROLE_ASSIGNMENT_EXPIRY_INTERVAL_MS, 30000),
    roleAssignmentExpiryStartupDelayMs: safeInt(env.ROLE_ASSIGNMENT_EXPIRY_STARTUP_DELAY_MS, 5000),
    roleAssignmentExpiryBatchLimit: safeInt(env.ROLE_ASSIGNMENT_EXPIRY_BATCH_LIMIT, 100),
  },
  sse: {
    broadcastBackend: env.SSE_BROADCAST_BACKEND === 'redis' ? 'redis' : 'local',
    redisUrl: env.SSE_REDIS_URL || env.RUNTIME_REDIS_URL || env.REDIS_URL || '',
    redisChannel: env.SSE_REDIS_CHANNEL || 'llm-forum:sse:broadcast',
    redisConnectTimeoutMs: safeInt(env.SSE_REDIS_CONNECT_TIMEOUT_MS, 5000),
  },
  publicObservation: {
    forumCooldownMs: safeInt(env.PO_FORUM_COOLDOWN_MS, 6 * 3600_000),
    roomCooldownMs: safeInt(env.PO_ROOM_COOLDOWN_MS, 3 * 3600_000),
    forumThreadTurnThreshold: safeInt(env.PO_FORUM_THREAD_TURN_THRESHOLD, 12),
    forumParticipantThreshold: safeInt(env.PO_FORUM_PARTICIPANT_THRESHOLD, 4),
    forumHeatThreshold: safeInt(env.PO_FORUM_HEAT_THRESHOLD, 30),
    roomMessageThreshold: safeInt(env.PO_ROOM_MSG_THRESHOLD, 80),
    roomActiveMinThreshold: safeInt(env.PO_ROOM_ACTIVE_MIN_THRESHOLD, 30),
    roomActiveMinMsgThreshold: safeInt(env.PO_ROOM_ACTIVE_MIN_MSG_THRESHOLD, 40),
  },
  controversy: {
    keywords: (env.CONTROVERSY_KEYWORDS || '不同意,反对,质疑,荒谬,错误,however,disagree,ridiculous,nonsense').split(','),
  },
  features: {
    guidanceV1: env.FF_GUIDANCE_V1 === 'true',
    guidanceRecallV1: env.FF_GUIDANCE_RECALL_V1 === 'true',
    homeProgrammingV1: env.FF_HOME_PROGRAMMING_V1 === 'true',
    programmingOpsV1: env.FF_PROGRAMMING_OPS_V1 === 'true',
    lightweightPersonalizationV1: env.FF_LIGHTWEIGHT_PERSONALIZATION_V1 === 'true',
    postLaunchTuningV1: env.FF_POST_LAUNCH_TUNING_V1 === 'true',
    allocatorPprEnabled: env.FF_ALLOCATOR_PPR_ENABLED === 'true',
    membershipsV1: env.FF_MEMBERSHIPS_V1 === 'true',
    globalHighlightsV1: env.FF_GLOBAL_HIGHLIGHTS_V1 === 'true',
    signalLogV1: env.FF_SIGNAL_LOG_V1 === 'true',
    castingDirectorV2: env.FF_CASTING_DIRECTOR_V2 === 'true',
    pprRefreshV2: env.FF_PPR_REFRESH_V2 === 'true',
    communityDigestV1: env.FF_COMMUNITY_DIGEST_V1 === 'true',
    runtimeFeaturesV1: env.FF_RUNTIME_FEATURES_V1 === 'true',
    forumOrchestrationShadow: env.FF_FORUM_ORCHESTRATION_SHADOW === 'true',
    forumOrchestrationSelectionCutover: env.FF_FORUM_ORCHESTRATION_SELECTION_CUTOVER === 'true',
    forumOrchestrationEnvelopeCutover: env.FF_FORUM_ORCHESTRATION_ENVELOPE_CUTOVER === 'true',
    castingDirectorEnabled: env.FF_CASTING_DIRECTOR_ENABLED === 'true',
    communityPromptProfileV1: env.FF_COMMUNITY_PROMPT_PROFILE_V1 === 'true',
    chronicleMetricsCacheV1: env.FF_CHRONICLE_METRICS_CACHE_V1 === 'true',
    promptAuditV1: env.FF_PROMPT_AUDIT_V1 === 'true',
    directorRuntimeStateV1: env.FF_DIRECTOR_RUNTIME_STATE_V1 === 'true',
    personaRuntimeV1: env.FF_PERSONA_RUNTIME_V1 === 'true',
    personaRuntimeScenes: (env.FF_PERSONA_RUNTIME_SCENES || DEFAULT_PERSONA_RUNTIME_SCENES.join(','))
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    personaWritebackV1: env.FF_PERSONA_WRITEBACK_V1 === 'true',
    achievementChronicleV1: env.FF_ACHIEVEMENT_CHRONICLE_V1 === 'true',
    achievementPublicHighlights: env.FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS === 'true',
    publicObservationMemory: env.FF_PUBLIC_OBSERVATION_MEMORY === 'true',
    socialGraphEffective: env.FF_SOCIAL_GRAPH_EFFECTIVE === 'true',
    socialGraphExplainer: env.FF_SOCIAL_GRAPH_EXPLAINER === 'true',
    agentStatsV1: env.FF_AGENT_STATS_V1 === 'true',
    agentStatsBehavior: env.FF_AGENT_STATS_BEHAVIOR === 'true',
    agentStatsRelationPolicy: env.FF_AGENT_STATS_RELATION_POLICY === 'true',
    agentStatsVotePolicy: env.FF_AGENT_STATS_VOTE_POLICY === 'true',
    agentStatsUi: env.FF_AGENT_STATS_UI === 'true',
    humanParticipationV1: env.FF_HUMAN_PARTICIPATION_V1 !== 'false',
    multimodalAgentMediaV1: env.FF_MULTIMODAL_AGENT_MEDIA_V1 === 'true',
    mediaGenerationV1: env.FF_MEDIA_GENERATION_V1 === 'true',
    mediaObservabilityV1: env.FF_MEDIA_OBSERVABILITY_V1 === 'true',
    mediaRolloutControllerV1: env.FF_MEDIA_ROLLOUT_CONTROLLER_V1 === 'true',
    mediaLifecycleV1: env.FF_MEDIA_LIFECYCLE_V1 === 'true',
    mediaForumThreadTurnSurfaceV1: env.FF_MEDIA_FORUM_THREAD_TURN_SURFACE_V1 !== 'false',
    mediaChatRoomSurfaceV1: env.FF_MEDIA_CHAT_ROOM_SURFACE_V1 !== 'false',
    mediaProactivePrivateSurfaceV1: env.FF_MEDIA_PROACTIVE_PRIVATE_SURFACE_V1 !== 'false',
    mediaHighlightsSurfaceV1: env.FF_MEDIA_HIGHLIGHTS_SURFACE_V1 !== 'false',
    stageTierV1: env.FF_STAGE_TIER_V1 === 'true',
    stageRoleRuntimeV1: env.FF_STAGE_ROLE_RUNTIME_V1 === 'true',
    membershipStatusV1: env.FF_MEMBERSHIP_STATUS_V1 === 'true',
    stageGovernanceV1: env.FF_STAGE_GOVERNANCE_V1 === 'true',
    incubationV1: env.FF_INCUBATION_V1 === 'true',
    incubationOrchestratorV1: env.FF_INCUBATION_ORCHESTRATOR_V1 === 'true',
    audienceZoneV1: env.FF_AUDIENCE_ZONE_V1 === 'true',
    aftershowV1: env.FF_AFTERSHOW_V1 === 'true',
    aftershowAudienceSummaryV1: env.FF_AFTERSHOW_AUDIENCE_SUMMARY_V1 === 'true',
    stageRotationV1: env.FF_STAGE_ROTATION_V1 === 'true',
    eventContractV1: env.FF_EVENT_CONTRACT_V1 === 'true',
    aftershowEventPipelineV1: env.FF_AFTERSHOW_EVENT_PIPELINE_V1 === 'true',
    roleAssignmentV1: env.FF_ROLE_ASSIGNMENT_V1 === 'true',
    audienceAftershowWebV1: env.FF_AUDIENCE_AFTERSHOW_WEB_V1 === 'true',
    riskControlV1: env.FF_RISK_CONTROL_V1 === 'true',
    riskControlPublicEnforce: env.FF_RISK_CONTROL_PUBLIC_ENFORCE === 'true',
    riskControlChatEnforce: env.FF_RISK_CONTROL_CHAT_ENFORCE === 'true',
    riskControlPrivateEnforce: env.FF_RISK_CONTROL_PRIVATE_ENFORCE === 'true',
    riskControlProactiveEnforce: env.FF_RISK_CONTROL_PROACTIVE_ENFORCE === 'true',
    hotTopicPolicyV1: env.FF_HOT_TOPIC_POLICY_V1 === 'true',
  },
} as const
