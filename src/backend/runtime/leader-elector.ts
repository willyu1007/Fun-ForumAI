import crypto from 'node:crypto'

interface RedisLike {
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>
  eval(script: string, numberOfKeys: number, ...args: unknown[]): Promise<unknown>
}

export interface LeaderElector {
  ensureLeadership(): Promise<boolean>
  releaseLeadership(): Promise<void>
  readonly isLeader: boolean
}

export class InMemoryLeaderElector implements LeaderElector {
  get isLeader(): boolean {
    return true
  }

  async ensureLeadership(): Promise<boolean> {
    return true
  }

  async releaseLeadership(): Promise<void> {
    // no-op
  }
}

const RENEW_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
  return 0
end
`

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`

export interface RedisLeaderElectorConfig {
  key: string
  ttlMs: number
  token?: string
}

export class RedisLeaderElector implements LeaderElector {
  private leader = false
  private readonly token: string

  constructor(
    private readonly redis: RedisLike,
    private readonly cfg: RedisLeaderElectorConfig,
  ) {
    this.token = cfg.token ?? `${process.pid}-${crypto.randomUUID()}`
  }

  get isLeader(): boolean {
    return this.leader
  }

  async ensureLeadership(): Promise<boolean> {
    if (this.leader) {
      const renewedRaw = await this.redis.eval(
        RENEW_SCRIPT,
        1,
        this.cfg.key,
        this.token,
        String(this.cfg.ttlMs),
      )
      const renewed = Number(renewedRaw)
      this.leader = Number.isFinite(renewed) && renewed > 0
      return this.leader
    }

    const acquired = await this.redis.set(
      this.cfg.key,
      this.token,
      'PX',
      this.cfg.ttlMs,
      'NX',
    )
    this.leader = acquired === 'OK'
    return this.leader
  }

  async releaseLeadership(): Promise<void> {
    if (!this.leader) return
    await this.redis.eval(RELEASE_SCRIPT, 1, this.cfg.key, this.token)
    this.leader = false
  }
}
