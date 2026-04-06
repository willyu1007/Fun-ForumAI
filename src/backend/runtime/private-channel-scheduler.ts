import type { PrivateChannelService } from '../services/private-channel-service.js'
import type { MemoryService } from '../services/memory-service.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { LeaderElector } from './leader-elector.js'

const SESSION_TIMEOUT_CHECK_MS = 5 * 60 * 1000 // 5 minutes
const MEMORY_DECAY_CHECK_MS = 24 * 60 * 60 * 1000 // 24 hours
const PENDING_REPLY_RECOVERY_CHECK_MS = 15 * 1000 // 15 seconds

export interface PrivateChannelSchedulerDeps {
  channelService: PrivateChannelService
  memoryService: MemoryService
  agentRepo: AgentRepository
  leaderElector?: LeaderElector
}

export class PrivateChannelScheduler {
  private sessionTimer: ReturnType<typeof setInterval> | null = null
  private decayTimer: ReturnType<typeof setInterval> | null = null
  private pendingReplyRecoveryTimer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(private readonly deps: PrivateChannelSchedulerDeps) {}

  start(): void {
    if (this.running) return
    this.running = true

    this.sessionTimer = setInterval(
      () => void this.checkSessionTimeouts(),
      SESSION_TIMEOUT_CHECK_MS,
    )

    this.decayTimer = setInterval(
      () => void this.runMemoryDecay(),
      MEMORY_DECAY_CHECK_MS,
    )

    this.pendingReplyRecoveryTimer = setInterval(
      () => void this.recoverPendingReplies(),
      PENDING_REPLY_RECOVERY_CHECK_MS,
    )

    // Run first decay check after a short delay (not blocking startup)
    setTimeout(() => void this.runMemoryDecay(), 60_000)

    console.log('[PrivateChannelScheduler] Started (session timeout: 5min, pending reply recovery: 15s, memory decay: 24h)')
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
    if (this.decayTimer) {
      clearInterval(this.decayTimer)
      this.decayTimer = null
    }
    if (this.pendingReplyRecoveryTimer) {
      clearInterval(this.pendingReplyRecoveryTimer)
      this.pendingReplyRecoveryTimer = null
    }
    if (this.deps.leaderElector) {
      void this.deps.leaderElector.releaseLeadership()
    }
    console.log('[PrivateChannelScheduler] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  private async checkSessionTimeouts(): Promise<void> {
    if (!(await this.ensureLeadership())) return

    try {
      const endedSessions = await this.deps.channelService.checkTimeouts()
      if (endedSessions.length > 0) {
        console.log(`[PrivateChannelScheduler] Timed out ${endedSessions.length} session(s)`)
        for (const session of endedSessions) {
          this.deps.memoryService.generateDigest(session.id).catch((err) => {
            console.error('[PrivateChannelScheduler] Timed-out digest generation failed:', err)
          })
        }
      }
    } catch (err) {
      console.error('[PrivateChannelScheduler] Session timeout check failed:', err)
    }
  }

  private async runMemoryDecay(): Promise<void> {
    if (!(await this.ensureLeadership())) return

    try {
      const agents = this.deps.agentRepo.findActive({ limit: 1000 })
      let totalDecayed = 0
      let totalForgotten = 0

      for (const agent of agents.items) {
        try {
          const result = await this.deps.memoryService.decayAndForget(agent.id)
          totalDecayed += result.decayed
          totalForgotten += result.forgotten
        } catch {
          // skip individual agent failures
        }
      }

      if (totalDecayed > 0 || totalForgotten > 0) {
        console.log(
          `[PrivateChannelScheduler] Memory decay: ${totalDecayed} decayed, ${totalForgotten} forgotten across ${agents.items.length} agents`,
        )
      }
    } catch (err) {
      console.error('[PrivateChannelScheduler] Memory decay failed:', err)
    }
  }

  private async recoverPendingReplies(): Promise<void> {
    if (!(await this.ensureLeadership())) return

    try {
      const recovered = await this.deps.channelService.recoverStalePendingReplies()
      if (recovered.length > 0) {
        console.log(`[PrivateChannelScheduler] Recovered ${recovered.length} stale private reply placeholder(s)`)
      }
    } catch (err) {
      console.error('[PrivateChannelScheduler] Pending private reply recovery failed:', err)
    }
  }

  private async ensureLeadership(): Promise<boolean> {
    if (!this.deps.leaderElector) return true
    return this.deps.leaderElector.ensureLeadership()
  }
}
