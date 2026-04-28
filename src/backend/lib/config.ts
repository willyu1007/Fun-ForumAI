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

function readBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return fallback
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

const launchCapabilities = {
  guidanceV1: readBooleanFlag(env.FF_GUIDANCE_V1, allowDevTools),
  guidanceRecallV1: readBooleanFlag(env.FF_GUIDANCE_RECALL_V1, allowDevTools),
  homeProgrammingV1: readBooleanFlag(env.FF_HOME_PROGRAMMING_V1, false),
  programmingOpsV1: readBooleanFlag(env.FF_PROGRAMMING_OPS_V1, false),
  lightweightPersonalizationV1: true,
  postLaunchTuningV1: true,
  allocatorPprEnabled: true,
  membershipsV1: true,
  globalHighlightsV1: readBooleanFlag(env.FF_GLOBAL_HIGHLIGHTS_V1, true),
  signalLogV1: true,
  castingDirectorV2: true,
  pprRefreshV2: true,
  communityDigestV1: true,
  runtimeFeaturesV1: true,
  forumOrchestrationShadow: false,
  forumOrchestrationSelectionCutover: true,
  forumOrchestrationEnvelopeCutover: true,
  castingDirectorEnabled: true,
  communityPromptProfileV1: true,
  chronicleMetricsCacheV1: true,
  promptAuditV1: true,
  directorRuntimeStateV1: true,
  personaRuntimeV1: true,
  personaRuntimeScenes: [...DEFAULT_PERSONA_RUNTIME_SCENES] as string[],
  personaWritebackV1: true,
  achievementChronicleV1: readBooleanFlag(env.FF_ACHIEVEMENT_CHRONICLE_V1, false),
  achievementPublicHighlights: readBooleanFlag(env.FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS, false),
  publicObservationMemory: readBooleanFlag(env.FF_PUBLIC_OBSERVATION_MEMORY, false),
  socialGraphEffective: true,
  socialGraphExplainer: false,
  agentStatsV1: readBooleanFlag(env.FF_AGENT_STATS_V1, true),
  agentStatsBehavior: readBooleanFlag(env.FF_AGENT_STATS_BEHAVIOR, false),
  agentStatsRelationPolicy: readBooleanFlag(env.FF_AGENT_STATS_RELATION_POLICY, false),
  agentStatsVotePolicy: readBooleanFlag(env.FF_AGENT_STATS_VOTE_POLICY, false),
  agentStatsUi: readBooleanFlag(env.FF_AGENT_STATS_UI, false),
  humanParticipationV1: true,
  multimodalAgentMediaV1: readBooleanFlag(env.FF_MULTIMODAL_AGENT_MEDIA_V1, false),
  mediaGenerationV1: readBooleanFlag(env.FF_MEDIA_GENERATION_V1, false),
  mediaObservabilityV1: readBooleanFlag(env.FF_MEDIA_OBSERVABILITY_V1, false),
  mediaRolloutControllerV1: readBooleanFlag(env.FF_MEDIA_ROLLOUT_CONTROLLER_V1, false),
  mediaLifecycleV1: readBooleanFlag(env.FF_MEDIA_LIFECYCLE_V1, false),
  mediaInjectionV1: readBooleanFlag(env.FF_MEDIA_INJECTION_V1, false),
  mediaRetrievalV1: readBooleanFlag(env.FF_MEDIA_RETRIEVAL_V1, false),
  mediaPlannerRetrievalV1: readBooleanFlag(env.FF_MEDIA_PLANNER_RETRIEVAL_V1, false),
  mediaForumThreadTurnSurfaceV1: true,
  mediaChatRoomSurfaceV1: true,
  mediaProactivePrivateSurfaceV1: true,
  mediaHighlightsSurfaceV1: true,
  stageTierV1: true,
  stageRoleRuntimeV1: true,
  membershipStatusV1: true,
  stageGovernanceV1: true,
  incubationV1: true,
  incubationOrchestratorV1: true,
  audienceZoneV1: true,
  aftershowV1: true,
  aftershowAudienceSummaryV1: true,
  stageRotationV1: true,
  eventContractV1: true,
  aftershowEventPipelineV1: true,
  roleAssignmentV1: true,
  audienceAftershowWebV1: true,
  riskControlV1: true,
  riskControlPublicEnforce: true,
  riskControlChatEnforce: true,
  riskControlPrivateEnforce: true,
  riskControlProactiveEnforce: true,
  hotTopicPolicyV1: true,
  runtimeOperationRecordsWrite: readBooleanFlag(
    env.FF_RUNTIME_OPERATION_RECORDS_WRITE,
    allowDevTools,
  ),
  adminRuntimeRecordsUi: readBooleanFlag(env.FF_ADMIN_RUNTIME_RECORDS_UI, allowDevTools),
}

export const config = {
  port: safeInt(env.PORT, 4000),
  nodeEnv,
  appEnv,
  allowDevTools,
  secureCookies,
  launch: {
    market: env.APP_MARKET === 'mainland' ? 'mainland' : 'global',
    capabilities: launchCapabilities,
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
    fallbackApiKey: env.DASHSCOPE_API_KEY || '',
    fallbackProvider: env.MEDIA_GENERATION_FALLBACK_PROVIDER || 'dashscope-qwen-image',
    fallbackModel: env.MEDIA_GENERATION_FALLBACK_MODEL || 'qwen-image-2.0',
    fallbackBaseUrl: env.MEDIA_GENERATION_FALLBACK_BASE_URL || 'https://dashscope.aliyuncs.com',
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
    activeProfile: 'baseline',
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
  mediaInjection: {
    workerId: env.MEDIA_INJECTION_WORKER_ID || `media-injection-worker:${process.pid}`,
    workerIntervalMs: safeInt(env.MEDIA_INJECTION_WORKER_INTERVAL_MS, 15_000),
    workerStartupDelayMs: safeInt(env.MEDIA_INJECTION_WORKER_STARTUP_DELAY_MS, 5_000),
    globalConcurrency: safeInt(env.MEDIA_INJECTION_GLOBAL_CONCURRENCY, 1),
    runningTimeoutMs: safeInt(env.MEDIA_INJECTION_RUNNING_TIMEOUT_MS, 10 * 60_000),
    stagedExpiryMs: safeInt(env.MEDIA_INJECTION_STAGED_EXPIRY_MS, 72 * 60 * 60_000),
    successInputRetentionMs: safeInt(env.MEDIA_INJECTION_SUCCESS_INPUT_RETENTION_MS, 24 * 60 * 60_000),
    failedInputRetentionMs: safeInt(env.MEDIA_INJECTION_FAILED_INPUT_RETENTION_MS, 7 * 24 * 60 * 60_000),
    resultArtifactRetentionMs: safeInt(env.MEDIA_INJECTION_RESULT_ARTIFACT_RETENTION_MS, 30 * 24 * 60 * 60_000),
    stagingPrefix: env.MEDIA_INJECTION_STAGING_PREFIX || 'staging/media-ingest',
    artifactPrefix: env.MEDIA_IMPORT_ARTIFACT_PREFIX || 'artifacts/media-import',
  },
  mediaRetrieval: {
    dashscopeApiKey: env.DASHSCOPE_API_KEY || '',
    dashscopeBaseUrl: env.MEDIA_RETRIEVAL_DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
    textEmbeddingModel: env.MEDIA_RETRIEVAL_MODEL || 'text-embedding-v4',
    queryInstruct:
      env.MEDIA_RETRIEVAL_QUERY_INSTRUCT
      || 'Given a media retrieval query, retrieve relevant safe media documents',
    timeoutMs: safeInt(env.MEDIA_RETRIEVAL_TIMEOUT_MS, 30_000),
    indexProfileId: 'text-embedding-v4-1024' as const,
    vectorDimension: safeInt(env.MEDIA_RETRIEVAL_VECTOR_DIMENSION, 1024),
    outputType: 'dense' as const,
    retrievalLimit: safeInt(env.MEDIA_RETRIEVAL_LIMIT, 24),
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
    warmupAttemptTimeoutMs: safeInt(env.RUNTIME_WARMUP_ATTEMPT_TIMEOUT_MS, 300_000),
    agentBioRefreshSchedulerEnabled: readBooleanFlag(
      env.RUNTIME_AGENT_BIO_REFRESH_SCHEDULER_ENABLED,
      true,
    ),
    agentBiographyCompileSchedulerEnabled: readBooleanFlag(
      env.RUNTIME_AGENT_BIOGRAPHY_COMPILE_SCHEDULER_ENABLED,
      true,
    ),
    homeProgrammingSnapshotSchedulerEnabled: readBooleanFlag(
      env.RUNTIME_HOME_PROGRAMMING_SNAPSHOT_SCHEDULER_ENABLED,
      true,
    ),
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
    publicDiscussionCueWorkerEnabled:
      env.PUBLIC_DISCUSSION_CUE_WORKER_ENABLED === 'true',
    publicDiscussionCueWorkerIntervalMs: safeInt(
      env.PUBLIC_DISCUSSION_CUE_WORKER_INTERVAL_MS,
      10_000,
    ),
    publicDiscussionCueWorkerStartupDelayMs: safeInt(
      env.PUBLIC_DISCUSSION_CUE_WORKER_STARTUP_DELAY_MS,
      5_000,
    ),
    publicDiscussionCueWorkerGraceSeconds: safeInt(
      env.PUBLIC_DISCUSSION_CUE_WORKER_GRACE_SECONDS,
      60,
    ),
    publicDiscussionCueWorkerLeaseSeconds: safeInt(
      env.PUBLIC_DISCUSSION_CUE_WORKER_LEASE_SECONDS,
      120,
    ),
    publicDiscussionCueWorkerBatchSize: safeInt(
      env.PUBLIC_DISCUSSION_CUE_WORKER_BATCH_SIZE,
      4,
    ),
    /**
     * T-216 — when on, `CueMediaPlanner` enforces `anchor` and
     * `selected_only_pool` through pre-write media planning. Default is on
     * after T-216 closure; set `CUE_MEDIA_POLICY_ANCHOR_MODE=false` for an
     * environment-level rollback.
     */
    cueMediaPolicyAnchorMode: readBooleanFlag(env.CUE_MEDIA_POLICY_ANCHOR_MODE, true),
    /**
     * T-214 A-M3 — auto-editor periodic scheduler. Off by default even
     * though `cue-auto-editor` is registered; each environment opts in
     * explicitly after validating the hidden director lane.
     */
    autoCueEditorSchedulerEnabled:
      env.AUTO_CUE_EDITOR_SCHEDULER_ENABLED === 'true',
    autoCueEditorSchedulerIntervalMs: safeInt(
      env.AUTO_CUE_EDITOR_SCHEDULER_INTERVAL_MS,
      60_000,
    ),
    autoCueEditorSchedulerStartupDelayMs: safeInt(
      env.AUTO_CUE_EDITOR_SCHEDULER_STARTUP_DELAY_MS,
      7_000,
    ),
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
}
