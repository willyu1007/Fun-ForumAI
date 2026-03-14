import { Prisma, type PrismaClient, type RuntimeSceneState as PrismaRuntimeSceneState } from '@prisma/client'
import type {
  CreateRuntimeSceneStateInput,
  RuntimeSceneState,
  SaveRuntimeSceneStatePatch,
} from '../types.js'
import type { RuntimeSceneStateRepository } from '../runtime-scene-state-repository.js'

export class PgRuntimeSceneStateRepository implements RuntimeSceneStateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async create(input: CreateRuntimeSceneStateInput): Promise<RuntimeSceneState> {
    const row = await this.prisma.runtimeSceneState.create({
      data: {
        runtimeSceneId: input.runtime_scene_id,
        directorSurface: input.director_surface,
        actorSurface: input.actor_surface,
        communityId: input.community_id ?? null,
        roomId: input.room_id ?? null,
        episodeId: input.episode_id,
        sceneTemplateId: input.scene_template_id,
        sceneTemplateVersion: input.scene_template_version,
        sceneBindingId: input.scene_binding_id ?? null,
        overlayId: input.overlay_id ?? null,
        phase: input.initial_state.phase,
        status: input.initial_state.status,
        fatigueScore: input.initial_state.dynamics.fatigue_score,
        repetitionScore: input.initial_state.dynamics.repetition_score,
        cooldownUntil: input.initial_state.cooldown_until ? new Date(input.initial_state.cooldown_until) : null,
        experimentBucket: input.experiment_bucket,
        stateVersion: input.initial_state.audit.state_version,
        stateJson: input.initial_state as unknown as Prisma.InputJsonValue,
      },
    })
    return this.toDomain(row)
  }

  async findByRuntimeSceneId(runtimeSceneId: string): Promise<RuntimeSceneState | null> {
    const row = await this.prisma.runtimeSceneState.findUnique({
      where: { runtimeSceneId },
    })
    return row ? this.toDomain(row) : null
  }

  async findActiveByRoom(roomId: string): Promise<RuntimeSceneState | null> {
    const row = await this.prisma.runtimeSceneState.findFirst({
      where: {
        roomId,
        status: { in: ['active', 'closing', 'cooldown', 'closed'] },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toDomain(row) : null
  }

  async findByEpisodeId(episodeId: string): Promise<RuntimeSceneState | null> {
    const row = await this.prisma.runtimeSceneState.findUnique({
      where: { episodeId },
    })
    return row ? this.toDomain(row) : null
  }

  async update(runtimeSceneId: string, patch: SaveRuntimeSceneStatePatch): Promise<RuntimeSceneState | null> {
    const nextStateVersion = patch.state_json.audit.state_version
    const result = await this.prisma.runtimeSceneState.updateMany({
      where: {
        runtimeSceneId,
        stateVersion: patch.expected_state_version,
      },
      data: {
        phase: patch.phase ?? patch.state_json.phase,
        status: patch.status ?? patch.state_json.status,
        fatigueScore: patch.fatigue_score ?? patch.state_json.dynamics.fatigue_score,
        repetitionScore: patch.repetition_score ?? patch.state_json.dynamics.repetition_score,
        cooldownUntil: patch.cooldown_until ?? (patch.state_json.cooldown_until ? new Date(patch.state_json.cooldown_until) : null),
        experimentBucket: patch.state_json.experiment.bucket,
        stateVersion: nextStateVersion,
        stateJson: patch.state_json as unknown as Prisma.InputJsonValue,
      },
    })
    if (result.count === 0) return null
    const row = await this.prisma.runtimeSceneState.findUnique({
      where: { runtimeSceneId },
    })
    return row ? this.toDomain(row) : null
  }

  async listBySurface(input: {
    director_surface: RuntimeSceneState['director_surface']
    status?: RuntimeSceneState['status']
  }): Promise<RuntimeSceneState[]> {
    const rows = await this.prisma.runtimeSceneState.findMany({
      where: {
        directorSurface: input.director_surface,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  private toDomain(row: PrismaRuntimeSceneState): RuntimeSceneState {
    return {
      id: row.id,
      runtime_scene_id: row.runtimeSceneId,
      director_surface: row.directorSurface as RuntimeSceneState['director_surface'],
      actor_surface: row.actorSurface as RuntimeSceneState['actor_surface'],
      community_id: row.communityId,
      room_id: row.roomId,
      episode_id: row.episodeId,
      scene_template_id: row.sceneTemplateId,
      scene_template_version: row.sceneTemplateVersion,
      scene_binding_id: row.sceneBindingId,
      overlay_id: row.overlayId,
      phase: row.phase as RuntimeSceneState['phase'],
      status: row.status as RuntimeSceneState['status'],
      fatigue_score: row.fatigueScore,
      repetition_score: row.repetitionScore,
      cooldown_until: row.cooldownUntil,
      experiment_bucket: row.experimentBucket as RuntimeSceneState['experiment_bucket'],
      state_version: row.stateVersion,
      state_json: row.stateJson as unknown as RuntimeSceneState['state_json'],
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
