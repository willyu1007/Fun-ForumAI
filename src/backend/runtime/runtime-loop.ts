import type { EventAllocator } from '../allocator/allocator.js'
import type { DegradationMonitor } from '../allocator/types.js'
import type { DefaultQuotaCalculator } from '../allocator/quota-calculator.js'
import type { AgentExecutor } from './agent-executor.js'
import type { PostScheduler } from './post-scheduler.js'
import type { RuntimeTickResult, AgentExecutionResult } from './types.js'
import type { LeaderElector } from './leader-elector.js'
import type { RuntimeEventQueue } from './event-queue.js'

export interface RuntimeLoopConfig {
  intervalMs: number
  batchSize: number
}

export interface RuntimeLoopDeps {
  queue: RuntimeEventQueue
  allocator: EventAllocator
  degradation: DegradationMonitor
  quotaCalc: DefaultQuotaCalculator
  executor: AgentExecutor
  postScheduler?: PostScheduler
  leaderElector?: LeaderElector
}

/**
 * Drives the event → allocate → execute loop.
 * Dequeues events, allocates agents via the allocator, then runs
 * the AgentExecutor for each allocation — preserving full EventPayload
 * for context building.
 */
export class RuntimeLoop {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private processing = false
  private lastKnownQueueSize = 0

  constructor(
    private readonly deps: RuntimeLoopDeps,
    private readonly cfg: RuntimeLoopConfig,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    console.log(
      `[RuntimeLoop] Started (interval=${this.cfg.intervalMs}ms, batch=${this.cfg.batchSize})`,
    )
    this.timer = setInterval(() => void this.tick(), this.cfg.intervalMs)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.deps.leaderElector) {
      void this.deps.leaderElector.releaseLeadership()
    }
    console.log('[RuntimeLoop] Stopped')
  }

  get isRunning(): boolean {
    return this.running
  }

  get isProcessing(): boolean {
    return this.processing
  }

  get queueSize(): number {
    return this.lastKnownQueueSize
  }

  get isLeader(): boolean {
    return this.deps.leaderElector?.isLeader ?? true
  }

  async getQueueSize(): Promise<number> {
    this.lastKnownQueueSize = await this.deps.queue.size()
    return this.lastKnownQueueSize
  }

  async tick(): Promise<RuntimeTickResult> {
    if (this.processing) {
      return emptyResult()
    }

    if (this.deps.leaderElector) {
      const leader = await this.deps.leaderElector.ensureLeadership()
      if (!leader) {
        return emptyResult()
      }
    }

    this.processing = true
    const executions: AgentExecutionResult[] = []
    let processedEvents = 0
    let totalAllocated = 0

    try {
      const { queue, allocator, quotaCalc, executor } = this.deps

      for (let i = 0; i < this.cfg.batchSize; i++) {
        await this.updateLag()

        const handle = await queue.dequeue()
        if (!handle) break
        const event = handle.event

        processedEvents++
        try {
          const allocationResult = allocator.allocate(event)

          if (allocationResult.agents.length === 0) {
            await handle.ack()
            continue
          }

          totalAllocated += allocationResult.agents.length

          if (event.post_id) {
            quotaCalc.recordThreadAllocation(event.post_id, allocationResult.agents.length)
          }

          const results = await executor.execute(event, allocationResult)
          executions.push(...results)
          await handle.ack()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`[RuntimeLoop] Failed to process event ${event.event_id}: ${message}`)
          await handle.retry(message)
        }
      }

      await this.updateLag()
      this.lastKnownQueueSize = await queue.size()

      // Autonomous posting: check if PostScheduler should create a new post
      let scheduledPost: RuntimeTickResult['scheduled_post']
      // Do not generate autonomous posts while backlog exists; it can amplify queue pressure.
      if (this.deps.postScheduler && this.lastKnownQueueSize === 0) {
        const postResult = await this.deps.postScheduler.createPost()
        if (postResult.triggered) {
          scheduledPost = postResult
        }
      }

      const successful = executions.filter((e) => e.success).length
      const failed = executions.length - successful

      if (processedEvents > 0 || scheduledPost) {
        console.log(
          `[RuntimeLoop] Tick: ${processedEvents} events, ${totalAllocated} agents, ${successful}✓ ${failed}✗` +
            (scheduledPost ? ` | scheduled-post: ${scheduledPost.post_id ?? 'failed'}` : ''),
        )
      }

      return {
        processed_events: processedEvents,
        executions,
        batch_stats: {
          allocated_agents: totalAllocated,
          successful,
          failed,
        },
        scheduled_post: scheduledPost,
      }
    } catch (err) {
      console.error('[RuntimeLoop] Tick error:', err)
      return {
        processed_events: processedEvents,
        executions,
        batch_stats: { allocated_agents: totalAllocated, successful: 0, failed: executions.length },
      }
    } finally {
      this.processing = false
    }
  }

  private async updateLag(): Promise<void> {
    const oldest = await this.deps.queue.oldestTimestampMs()
    if (oldest === null) {
      this.deps.degradation.reportLag(0)
      return
    }
    this.deps.degradation.reportLag(Math.max(0, (Date.now() - oldest) / 1000))
  }
}

function emptyResult(): RuntimeTickResult {
  return {
    processed_events: 0,
    executions: [],
    batch_stats: { allocated_agents: 0, successful: 0, failed: 0 },
  }
}
