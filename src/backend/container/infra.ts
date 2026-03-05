import { Redis } from 'ioredis'
import { ModerationService } from '../moderation/moderation-service.js'
import { DefaultRuleFilter } from '../moderation/rule-filter.js'
import { KeywordRiskClassifier } from '../moderation/risk-classifier.js'
import { DefaultDecisionEngine } from '../moderation/decision-engine.js'
import { SseHub } from '../sse/hub.js'
import { LocalSseBroadcastAdapter } from '../sse/adapters/local-broadcast-adapter.js'
import { RedisPubSubSseBroadcastAdapter } from '../sse/adapters/redis-pubsub-broadcast-adapter.js'
import {
  InMemoryRuntimeEventQueue,
  RedisStreamRuntimeEventQueue,
  type RuntimeEventQueue,
} from '../runtime/event-queue.js'
import {
  InMemoryLeaderElector,
  RedisLeaderElector,
  type LeaderElector,
} from '../runtime/leader-elector.js'
import { config } from '../lib/config.js'

export interface InfraResult {
  sseHub: SseHub
  moderator: ModerationService
  runtimeRedis: Redis | null
  sseRedisPublisher: Redis | null
  sseRedisSubscriber: Redis | null
  eventQueue: RuntimeEventQueue
  leaderElectors: {
    runtimeLoop: LeaderElector
    roomLifecycle: LeaderElector
    conversationClock: LeaderElector
    privateChannel: LeaderElector
    nurture: LeaderElector
    relation: LeaderElector
    achievements: LeaderElector
    pprRefresh: LeaderElector
    cultureDigest: LeaderElector
  }
}

export async function createInfrastructure(): Promise<InfraResult> {
  const sseHub = new SseHub({
    instanceId: `sse-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
  })

  const moderator = new ModerationService({
    ruleFilter: new DefaultRuleFilter(),
    classifier: new KeywordRiskClassifier(),
    decisionEngine: new DefaultDecisionEngine(),
  })

  let runtimeRedis: Redis | null = null
  let sseRedisPublisher: Redis | null = null
  let sseRedisSubscriber: Redis | null = null

  const needsRuntimeRedis = config.runtime.queueBackend === 'redis' || config.runtime.leaderBackend === 'redis'
  if (needsRuntimeRedis) {
    if (!config.runtime.redisUrl) {
      console.warn('[RuntimeInfra] Redis backend requested but RUNTIME_REDIS_URL/REDIS_URL is empty. Falling back to in-memory runtime infra.')
    } else {
      const redis = new Redis(config.runtime.redisUrl, {
        lazyConnect: true,
        connectTimeout: config.runtime.redisConnectTimeoutMs,
        maxRetriesPerRequest: 1,
      })
      try {
        await redis.connect()
        await redis.ping()
        runtimeRedis = redis
        console.log('[RuntimeInfra] Connected to Redis runtime backend')
      } catch (err) {
        console.warn('[RuntimeInfra] Failed to connect Redis runtime backend, fallback to in-memory:', err)
        await redis.quit().catch(() => undefined)
      }
    }
  }

  const needsSseRedis = config.sse.broadcastBackend === 'redis'
  if (needsSseRedis) {
    if (!config.sse.redisUrl) {
      console.warn('[SSE] Redis broadcast requested but SSE_REDIS_URL/RUNTIME_REDIS_URL/REDIS_URL is empty. Falling back to local broadcast.')
    } else {
      const publisher = new Redis(config.sse.redisUrl, {
        lazyConnect: true,
        connectTimeout: config.sse.redisConnectTimeoutMs,
        maxRetriesPerRequest: 1,
      })
      const subscriber = publisher.duplicate({
        lazyConnect: true,
        connectTimeout: config.sse.redisConnectTimeoutMs,
        maxRetriesPerRequest: 1,
      })
      try {
        await Promise.all([publisher.connect(), subscriber.connect()])
        await publisher.ping()
        sseRedisPublisher = publisher
        sseRedisSubscriber = subscriber
        console.log('[SSE] Connected to Redis broadcast backend')
      } catch (err) {
        console.warn('[SSE] Failed to connect Redis broadcast backend, falling back to local:', err)
        await Promise.allSettled([publisher.quit(), subscriber.quit()])
      }
    }
  }

  const sseBroadcastAdapter =
    config.sse.broadcastBackend === 'redis' && sseRedisPublisher && sseRedisSubscriber
      ? new RedisPubSubSseBroadcastAdapter({
          channel: config.sse.redisChannel,
          publisher: sseRedisPublisher,
          subscriber: sseRedisSubscriber,
        })
      : new LocalSseBroadcastAdapter()

  await sseHub.setBroadcastAdapter(sseBroadcastAdapter)
  console.log(`[SSE] Broadcast backend: ${sseBroadcastAdapter.backend}`)

  function runtimeKey(suffix: string): string {
    return `${config.runtime.redisPrefix}:${suffix}`
  }

  function createLeaderElector(scope: string): LeaderElector {
    if (config.runtime.leaderBackend === 'redis' && runtimeRedis) {
      return new RedisLeaderElector(runtimeRedis, {
        key: runtimeKey(`leader:${scope}`),
        ttlMs: config.runtime.leaderTtlMs,
      })
    }
    return new InMemoryLeaderElector()
  }

  const eventQueue: RuntimeEventQueue =
    config.runtime.queueBackend === 'redis' && runtimeRedis
      ? new RedisStreamRuntimeEventQueue(runtimeRedis, {
          streamKey: runtimeKey('queue:events'),
          deadLetterStreamKey: runtimeKey('queue:events:dlq'),
          consumerGroup: 'runtime-loop',
          consumerName: `${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
          visibilityTimeoutMs: config.runtime.queueVisibilityTimeoutMs,
          maxRetries: config.runtime.queueMaxRetries,
          pollTimeoutMs: config.runtime.queuePollTimeoutMs,
        })
      : new InMemoryRuntimeEventQueue()

  return {
    sseHub,
    moderator,
    runtimeRedis,
    sseRedisPublisher,
    sseRedisSubscriber,
    eventQueue,
    leaderElectors: {
      runtimeLoop: createLeaderElector('runtime-loop'),
      roomLifecycle: createLeaderElector('room-lifecycle'),
      conversationClock: createLeaderElector('conversation-clock'),
      privateChannel: createLeaderElector('private-channel'),
      nurture: createLeaderElector('nurture'),
      relation: createLeaderElector('relation'),
      achievements: createLeaderElector('achievements'),
      pprRefresh: createLeaderElector('ppr-refresh'),
      cultureDigest: createLeaderElector('culture-digest'),
    },
  }
}
