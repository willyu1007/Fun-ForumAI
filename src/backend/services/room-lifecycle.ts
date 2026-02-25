import type { RoomRepository } from '../repos/room-repository.js'
import type { SseHub } from '../sse/hub.js'
import type { LeaderElector } from '../runtime/leader-elector.js'

const COOLING_THRESHOLD_MS = 30 * 60 * 1000
const ARCHIVE_THRESHOLD_MS = 4 * 60 * 60 * 1000
const TICK_INTERVAL_MS = 60_000

export class RoomLifecycleManager {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly sseHub: SseHub,
    private readonly leaderElector?: LeaderElector,
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, TICK_INTERVAL_MS)
    console.log('[RoomLifecycle] Started (60s interval)')
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.leaderElector) {
      void this.leaderElector.releaseLeadership()
    }
  }

  async tick(): Promise<void> {
    if (this.leaderElector) {
      const leader = await this.leaderElector.ensureLeadership()
      if (!leader) return
    }

    const now = Date.now()

    const activeRooms = this.roomRepo.list({ limit: 200, status: 'active' })
    for (const room of activeRooms.items) {
      const lastActivity = room.last_message_at?.getTime() ?? room.created_at.getTime()
      if (now - lastActivity > COOLING_THRESHOLD_MS) {
        this.roomRepo.updateStatus(room.id, 'cooling')
        this.sseHub.broadcastToRoom(room.id, {
          type: 'ROOM_STATUS_CHANGED',
          payload: { room_id: room.id, status: 'cooling' },
        })
        console.log(`[RoomLifecycle] Room ${room.id} → cooling`)
      }
    }

    const coolingRooms = this.roomRepo.list({ limit: 200, status: 'cooling' })
    for (const room of coolingRooms.items) {
      const lastActivity = room.last_message_at?.getTime() ?? room.created_at.getTime()
      if (now - lastActivity > ARCHIVE_THRESHOLD_MS) {
        this.roomRepo.updateStatus(room.id, 'archived')
        const members = this.roomRepo.getMembers(room.id)
        for (const member of members) {
          this.roomRepo.removeMember(room.id, member.member_id)
        }
        this.sseHub.broadcastToRoom(room.id, {
          type: 'ROOM_STATUS_CHANGED',
          payload: { room_id: room.id, status: 'archived' },
        })
        console.log(`[RoomLifecycle] Room ${room.id} → archived (${members.length} members removed)`)
      }
    }
  }
}
