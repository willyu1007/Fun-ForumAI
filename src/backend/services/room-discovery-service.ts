import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { AgentPublicProjectionView, Room } from '../repos/types.js'

export interface RoomDiscoveryCandidate {
  room: Room
  score: number
  reasons: string[]
}

export interface RoomDiscoveryServiceDeps {
  roomRepo: RoomRepository
  watchabilityRepo: RoomWatchabilityRepository
}

export class RoomDiscoveryService {
  constructor(private readonly deps: RoomDiscoveryServiceDeps) {}

  async rankRoomsForAgent(input: {
    agentId: string
    currentRoomId: string
    projection: AgentPublicProjectionView | null
  }): Promise<RoomDiscoveryCandidate[]> {
    const [rooms, memberships] = await Promise.all([
      this.deps.roomRepo.getAvailableRooms(),
      this.deps.roomRepo.getRoomsByAgent(input.agentId),
    ])
    const joinedRoomIds = new Set(memberships.map((room) => room.id))
    const candidateRooms = rooms.filter((room) => room.id !== input.currentRoomId && !joinedRoomIds.has(room.id))
    if (candidateRooms.length === 0) return []

    const roomIds = candidateRooms.map((room) => room.id)
    const [programs, snapshots] = await Promise.all([
      this.deps.watchabilityRepo.listPrograms(roomIds),
      this.deps.watchabilityRepo.listLiveSnapshots(roomIds),
    ])
    const programsByRoomId = new Map(programs.map((program) => [program.room_id, program]))
    const snapshotsByRoomId = new Map(snapshots.map((snapshot) => [snapshot.room_id, snapshot]))

    return candidateRooms
      .map((room) => {
        const program = programsByRoomId.get(room.id)
        const snapshot = snapshotsByRoomId.get(room.id) ?? null

        let score = 0.22
        const reasons: string[] = []
        reasons.push('active', 'has_seat')
        if (program?.enabled) {
          score += 0.18
          reasons.push('program_enabled')
        }
        const sceneBonus = input.projection
          ? (input.projection.scene_affinity_json[program?.scene_type ?? 'FREE_CHAT'] ?? 0) * 0.28
          : 0
        if (sceneBonus > 0) {
          score += sceneBonus
          reasons.push('scene_affinity')
        }
        const freshness = room.last_message_at
          ? Math.max(0, 1 - (Date.now() - room.last_message_at.getTime()) / (60 * 60 * 1000))
          : 0
        if (freshness > 0) {
          score += freshness * 0.14
          reasons.push('fresh_activity')
        }
        if (snapshot?.last_highlight_text) {
          score += 0.08
          reasons.push('has_highlight')
        }

        return {
          room,
          score: Number(score.toFixed(3)),
          reasons,
        } satisfies RoomDiscoveryCandidate
      })
      .sort((left, right) => right.score - left.score || left.room.id.localeCompare(right.room.id))
  }
}
