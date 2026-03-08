const env = process.env

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

export const config = {
  port: safeInt(env.PORT, 4000),
  nodeEnv: env.NODE_ENV || 'development',
  cors: {
    origins: env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  db: {
    url: env.DATABASE_URL || `postgresql://${env.USER ?? 'postgres'}@localhost:5432/llm_forum_dev`,
    usePrisma: env.DB_PERSISTENCE === 'true',
  },
  auth: {
    jwtSecret: env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  },
  serviceAuth: {
    secret: env.SERVICE_AUTH_SECRET || 'dev-service-secret-change-in-production',
    timestampToleranceMs: 5 * 60 * 1000,
  },
  // Bootstrap-only defaults until the versioned gateway/router becomes the
  // single calling surface. Visible generation authority should not rely on
  // these values long-term.
  llm: {
    provider: env.LLM_PROVIDER || 'openai-compatible',
    model: env.LLM_MODEL || 'qwen-plus',
    apiKey: env.LLM_API_KEY || '',
    baseUrl: env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    maxTokens: safeInt(env.LLM_MAX_TOKENS, 512),
    temperature: safeFloat(env.LLM_TEMPERATURE, 0.8),
    maxRetries: safeInt(env.LLM_MAX_RETRIES, 2),
    timeoutMs: safeInt(env.LLM_TIMEOUT_MS, 30000),
  },
  inclinationAssets: {
    storageBackend: env.INCLINATION_ASSET_STORAGE_BACKEND === 's3' ? 's3' : 'local',
    localDir: env.INCLINATION_ASSET_LOCAL_DIR || 'var/inclination-assets',
    publicBaseUrl: env.INCLINATION_ASSET_PUBLIC_BASE_URL || '',
    s3: {
      bucket: env.INCLINATION_ASSET_S3_BUCKET || '',
      region: env.INCLINATION_ASSET_S3_REGION || 'us-east-1',
      endpoint: env.INCLINATION_ASSET_S3_ENDPOINT || '',
      forcePathStyle: env.INCLINATION_ASSET_S3_FORCE_PATH_STYLE === 'true',
      accessKeyId: env.INCLINATION_ASSET_S3_ACCESS_KEY_ID || '',
      secretAccessKey: env.INCLINATION_ASSET_S3_SECRET_ACCESS_KEY || '',
    },
  },
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
    forumCommentThreshold: safeInt(env.PO_FORUM_COMMENT_THRESHOLD, 12),
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
    allocatorPprEnabled: env.FF_ALLOCATOR_PPR_ENABLED === 'true',
    membershipsV1: env.FF_MEMBERSHIPS_V1 === 'true',
    globalHighlightsV1: env.FF_GLOBAL_HIGHLIGHTS_V1 === 'true',
    signalLogV1: env.FF_SIGNAL_LOG_V1 === 'true',
    castingDirectorV2: env.FF_CASTING_DIRECTOR_V2 === 'true',
    pprRefreshV2: env.FF_PPR_REFRESH_V2 === 'true',
    communityDigestV1: env.FF_COMMUNITY_DIGEST_V1 === 'true',
    runtimeFeaturesV1: env.FF_RUNTIME_FEATURES_V1 === 'true',
    castingDirectorEnabled: env.FF_CASTING_DIRECTOR_ENABLED === 'true',
    communityPromptProfileV1: env.FF_COMMUNITY_PROMPT_PROFILE_V1 === 'true',
    chronicleSignalPolicyV2: env.FF_CHRONICLE_SIGNAL_POLICY_V2 === 'true',
    chronicleMetricsCacheV1: env.FF_CHRONICLE_METRICS_CACHE_V1 === 'true',
    layerStackV2: env.FF_LAYER_STACK_V2 === 'true',
    promptAuditV1: env.FF_PROMPT_AUDIT_V1 === 'true',
    promptOrchestratorV1: env.FF_PROMPT_ORCHESTRATOR_V1 === 'true',
    promptOrchestratorScenes: (env.FF_PROMPT_ORCHESTRATOR_SCENES || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    achievementChronicleV1: env.FF_ACHIEVEMENT_CHRONICLE_V1 === 'true',
    achievementPublicHighlights: env.FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS === 'true',
    nurturePipelineV2: env.FF_NURTURE_PIPELINE_V2 === 'true',
    publicObservationMemory: env.FF_PUBLIC_OBSERVATION_MEMORY === 'true',
    socialGraphV1: env.FF_SOCIAL_GRAPH_V1 === 'true',
    socialGraphEffective: env.FF_SOCIAL_GRAPH_EFFECTIVE === 'true',
    socialGraphExplainer: env.FF_SOCIAL_GRAPH_EXPLAINER === 'true',
    agentStatsV1: env.FF_AGENT_STATS_V1 === 'true',
    agentStatsBehavior: env.FF_AGENT_STATS_BEHAVIOR === 'true',
    agentStatsRelationPolicy: env.FF_AGENT_STATS_RELATION_POLICY === 'true',
    agentStatsVotePolicy: env.FF_AGENT_STATS_VOTE_POLICY === 'true',
    agentStatsUi: env.FF_AGENT_STATS_UI === 'true',
    humanParticipationV1: env.FF_HUMAN_PARTICIPATION_V1 !== 'false',
    multimodalAgentInclinationV1: env.FF_MULTIMODAL_AGENT_INCLINATION_V1 === 'true',
    stageSpecV1: env.FF_STAGE_SPEC_V1 === 'true',
    stageTierV1: env.FF_STAGE_TIER_V1 === 'true',
    stageRoleRuntimeV1: env.FF_STAGE_ROLE_RUNTIME_V1 === 'true',
    membershipStatusV1: env.FF_MEMBERSHIP_STATUS_V1 === 'true',
    stageGovernanceV1: env.FF_STAGE_GOVERNANCE_V1 === 'true',
    incubationV1: env.FF_INCUBATION_V1 === 'true',
    incubationOrchestratorV1: env.FF_INCUBATION_ORCHESTRATOR_V1 === 'true',
    incubationTrustHardEnforce: env.FF_INCUBATION_TRUST_HARD_ENFORCE === 'true',
    audienceZoneV1: env.FF_AUDIENCE_ZONE_V1 === 'true',
    aftershowV1: env.FF_AFTERSHOW_V1 === 'true',
    aftershowAudienceSummaryV1: env.FF_AFTERSHOW_AUDIENCE_SUMMARY_V1 === 'true',
    stageRotationV1: env.FF_STAGE_ROTATION_V1 === 'true',
    eventContractV1: env.FF_EVENT_CONTRACT_V1 === 'true',
    controlPlaneConfigV1: env.FF_CONTROL_PLANE_CONFIG_V1 === 'true',
    aftershowEventPipelineV1: env.FF_AFTERSHOW_EVENT_PIPELINE_V1 === 'true',
    roleAssignmentV1: env.FF_ROLE_ASSIGNMENT_V1 === 'true',
    audienceAftershowWebV1: env.FF_AUDIENCE_AFTERSHOW_WEB_V1 === 'true',
  },
} as const
