import {
  Prisma,
  type MediaScenePackRecord as PrismaMediaScenePackRecord,
  type MediaScenePackVersionRecord as PrismaMediaScenePackVersionRecord,
} from '@prisma/client'
import type {
  CreateMediaScenePackInput,
  CreateMediaScenePackVersionInput,
  MediaScenePack,
  MediaScenePackVersion,
  MediaScenePackWithVersions,
  UpdateMediaScenePackVersionPatch,
} from '../types.js'
import type {
  MediaScenePackRepository,
  UpdateMediaScenePackPatch,
} from '../media-scene-pack-repository.js'
import type { PrismaDbClient } from './prisma-db-client.js'

type ScenePackWithVersionsRow = PrismaMediaScenePackRecord & {
  versions: PrismaMediaScenePackVersionRecord[]
}

export class PgMediaScenePackRepository implements MediaScenePackRepository {
  constructor(private readonly prisma: PrismaDbClient) {}

  async createPack(input: CreateMediaScenePackInput): Promise<MediaScenePack> {
    const row = await this.prisma.mediaScenePackRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        sceneId: input.scene_id,
        displayName: input.display_name,
        mediaFamily: input.media_family,
        status: input.status ?? 'active',
        activeVersion: input.active_version ?? 1,
      },
    })
    return toPack(row)
  }

  async findPackBySceneId(sceneId: string): Promise<MediaScenePack | null> {
    const row = await this.prisma.mediaScenePackRecord.findUnique({
      where: { sceneId },
    })
    return row ? toPack(row) : null
  }

  async updatePack(id: string, patch: UpdateMediaScenePackPatch): Promise<MediaScenePack | null> {
    const row = await this.prisma.mediaScenePackRecord.update({
      where: { id },
      data: {
        ...(patch.display_name !== undefined ? { displayName: patch.display_name } : {}),
        ...(patch.media_family !== undefined ? { mediaFamily: patch.media_family } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.active_version !== undefined ? { activeVersion: patch.active_version } : {}),
      },
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    })
    return row ? toPack(row) : null
  }

  async listWithVersions(): Promise<MediaScenePackWithVersions[]> {
    const rows = await this.prisma.mediaScenePackRecord.findMany({
      include: { versions: true },
      orderBy: [{ sceneId: 'asc' }],
    })
    return rows.map(toWithVersions)
  }

  async findWithVersionsBySceneId(sceneId: string): Promise<MediaScenePackWithVersions | null> {
    const row = await this.prisma.mediaScenePackRecord.findUnique({
      where: { sceneId },
      include: { versions: true },
    })
    return row ? toWithVersions(row) : null
  }

  async createVersion(input: CreateMediaScenePackVersionInput): Promise<MediaScenePackVersion> {
    const row = await this.prisma.mediaScenePackVersionRecord.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        packId: input.pack_id,
        sceneId: input.scene_id,
        version: input.version,
        status: input.status ?? 'draft',
        displayName: input.display_name,
        mediaFamily: input.media_family,
        whenToUse: input.when_to_use as unknown as Prisma.InputJsonValue,
        doNotUseWhen: input.do_not_use_when as unknown as Prisma.InputJsonValue,
        visualContract: input.visual_contract as unknown as Prisma.InputJsonValue,
        safetyBoundaries: input.safety_boundaries as unknown as Prisma.InputJsonValue,
        promptSystem: input.prompt_system,
        qualityGate: input.quality_gate as unknown as Prisma.InputJsonValue,
        createdByUserId: input.created_by_user_id ?? null,
        activatedAt: input.activated_at ?? null,
        releasedAt: input.released_at ?? null,
      },
    })
    return toVersion(row)
  }

  async findVersion(sceneId: string, version: number): Promise<MediaScenePackVersion | null> {
    const row = await this.prisma.mediaScenePackVersionRecord.findFirst({
      where: { sceneId, version },
    })
    return row ? toVersion(row) : null
  }

  async updateVersion(
    id: string,
    patch: UpdateMediaScenePackVersionPatch,
  ): Promise<MediaScenePackVersion | null> {
    const row = await this.prisma.mediaScenePackVersionRecord.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.display_name !== undefined ? { displayName: patch.display_name } : {}),
        ...(patch.media_family !== undefined ? { mediaFamily: patch.media_family } : {}),
        ...(patch.when_to_use !== undefined
          ? { whenToUse: patch.when_to_use as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.do_not_use_when !== undefined
          ? { doNotUseWhen: patch.do_not_use_when as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.visual_contract !== undefined
          ? { visualContract: patch.visual_contract as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.safety_boundaries !== undefined
          ? { safetyBoundaries: patch.safety_boundaries as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.prompt_system !== undefined ? { promptSystem: patch.prompt_system } : {}),
        ...(patch.quality_gate !== undefined
          ? { qualityGate: patch.quality_gate as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.created_by_user_id !== undefined ? { createdByUserId: patch.created_by_user_id } : {}),
        ...(patch.activated_at !== undefined ? { activatedAt: patch.activated_at } : {}),
        ...(patch.released_at !== undefined ? { releasedAt: patch.released_at } : {}),
      },
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    })
    return row ? toVersion(row) : null
  }

  async updateVersionStatuses(
    packId: string,
    status: MediaScenePackVersion['status'],
    patch: UpdateMediaScenePackVersionPatch,
    options?: { except_version?: number },
  ): Promise<number> {
    const result = await this.prisma.mediaScenePackVersionRecord.updateMany({
      where: {
        packId,
        status,
        ...(options?.except_version !== undefined ? { version: { not: options.except_version } } : {}),
      },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.activated_at !== undefined ? { activatedAt: patch.activated_at } : {}),
        ...(patch.released_at !== undefined ? { releasedAt: patch.released_at } : {}),
        ...(patch.created_by_user_id !== undefined ? { createdByUserId: patch.created_by_user_id } : {}),
      },
    })
    return result.count
  }
}

function toPack(row: PrismaMediaScenePackRecord): MediaScenePack {
  return {
    id: row.id,
    scene_id: row.sceneId,
    display_name: row.displayName,
    media_family: row.mediaFamily,
    status: row.status as MediaScenePack['status'],
    active_version: row.activeVersion,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toVersion(row: PrismaMediaScenePackVersionRecord): MediaScenePackVersion {
  return {
    id: row.id,
    pack_id: row.packId,
    scene_id: row.sceneId,
    version: row.version,
    status: row.status as MediaScenePackVersion['status'],
    display_name: row.displayName,
    media_family: row.mediaFamily,
    when_to_use: Array.isArray(row.whenToUse) ? row.whenToUse as string[] : [],
    do_not_use_when: Array.isArray(row.doNotUseWhen) ? row.doNotUseWhen as string[] : [],
    visual_contract: row.visualContract as unknown as MediaScenePackVersion['visual_contract'],
    safety_boundaries: row.safetyBoundaries as unknown as MediaScenePackVersion['safety_boundaries'],
    prompt_system: row.promptSystem,
    quality_gate: row.qualityGate as unknown as MediaScenePackVersion['quality_gate'],
    created_by_user_id: row.createdByUserId,
    activated_at: row.activatedAt,
    released_at: row.releasedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toWithVersions(row: ScenePackWithVersionsRow): MediaScenePackWithVersions {
  const pack = toPack(row)
  const versions = row.versions.map(toVersion).sort((left, right) => right.version - left.version)
  return {
    ...pack,
    versions,
    active_version_record:
      versions.find((version) => version.version === pack.active_version && version.status === 'active') ?? null,
  }
}
