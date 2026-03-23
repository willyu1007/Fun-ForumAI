import { Prisma, type PrismaClient, type SceneMediaBinding as PrismaSceneMediaBinding } from '@prisma/client'
import type {
  CreateSceneMediaBindingInput,
  MediaSceneType,
  SceneMediaBinding,
} from '../types.js'
import type { SceneMediaBindingRepository } from '../scene-media-binding-repository.js'

export class PgSceneMediaBindingRepository implements SceneMediaBindingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateSceneMediaBindingInput): Promise<SceneMediaBinding> {
    const row = await this.prisma.sceneMediaBinding.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        sceneType: input.scene_type,
        sceneId: input.scene_id,
        threadRootRef: input.thread_root_ref ?? null,
        assetId: input.asset_id,
        semanticSnapshotId: input.semantic_snapshot_id,
        sourceSceneType: input.source_scene_type ?? null,
        sourceSceneId: input.source_scene_id ?? null,
        bindingRole: input.binding_role,
        relationToScene: input.relation_to_scene,
        bindingNoteText: input.binding_note_text ?? null,
        displayPolicy: input.display_policy,
        createdByType: input.created_by_type,
        createdById: input.created_by_id,
      },
    })
    return this.toDomain(row)
  }

  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.prisma.sceneMediaBinding.deleteMany({
      where: { id: { in: ids } },
    })
    return result.count
  }

  async findByAssetId(assetId: string): Promise<SceneMediaBinding[]> {
    const rows = await this.prisma.sceneMediaBinding.findMany({
      where: { assetId },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findByAssetIds(assetIds: string[]): Promise<SceneMediaBinding[]> {
    if (assetIds.length === 0) return []
    const rows = await this.prisma.sceneMediaBinding.findMany({
      where: { assetId: { in: assetIds } },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findByThreadRootRef(
    threadRootRef: string,
    options?: {
      limit?: number
    },
  ): Promise<SceneMediaBinding[]> {
    const rows = await this.prisma.sceneMediaBinding.findMany({
      where: { threadRootRef },
      orderBy: [{ createdAt: 'desc' }],
      ...(typeof options?.limit === 'number' && options.limit > 0
        ? { take: options.limit }
        : {}),
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findLatestByAssetAndSceneType(
    assetId: string,
    sceneType: MediaSceneType,
  ): Promise<SceneMediaBinding | null> {
    const row = await this.prisma.sceneMediaBinding.findFirst({
      where: { assetId, sceneType },
      orderBy: [{ createdAt: 'desc' }],
    })
    return row ? this.toDomain(row) : null
  }

  async findByScene(sceneType: MediaSceneType, sceneId: string): Promise<SceneMediaBinding[]> {
    const rows = await this.prisma.sceneMediaBinding.findMany({
      where: { sceneType, sceneId },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findByScenes(sceneType: MediaSceneType, sceneIds: string[]): Promise<SceneMediaBinding[]> {
    if (sceneIds.length === 0) return []
    const rows = await this.prisma.sceneMediaBinding.findMany({
      where: {
        sceneType,
        sceneId: { in: sceneIds },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map((row) => this.toDomain(row))
  }

  async updateSemanticSnapshotId(
    id: string,
    semanticSnapshotId: string,
  ): Promise<SceneMediaBinding | null> {
    const row = await this.prisma.sceneMediaBinding.update({
      where: { id },
      data: { semanticSnapshotId },
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    })
    return row ? this.toDomain(row) : null
  }

  private toDomain(row: PrismaSceneMediaBinding): SceneMediaBinding {
    return {
      id: row.id,
      scene_type: row.sceneType as SceneMediaBinding['scene_type'],
      scene_id: row.sceneId,
      thread_root_ref: row.threadRootRef,
      asset_id: row.assetId,
      semantic_snapshot_id: row.semanticSnapshotId,
      source_scene_type: row.sourceSceneType,
      source_scene_id: row.sourceSceneId,
      binding_role: row.bindingRole as SceneMediaBinding['binding_role'],
      relation_to_scene: row.relationToScene as SceneMediaBinding['relation_to_scene'],
      binding_note_text: row.bindingNoteText,
      display_policy: row.displayPolicy as SceneMediaBinding['display_policy'],
      created_by_type: row.createdByType as SceneMediaBinding['created_by_type'],
      created_by_id: row.createdById,
      created_at: row.createdAt,
    }
  }
}
