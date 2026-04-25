import type {
  CreateMediaScenePackInput,
  CreateMediaScenePackVersionInput,
  MediaScenePack,
  MediaScenePackVersion,
  MediaScenePackVersionStatus,
  MediaScenePackWithVersions,
  UpdateMediaScenePackVersionPatch,
} from './types.js'

export interface UpdateMediaScenePackPatch {
  display_name?: string
  media_family?: string
  status?: MediaScenePack['status']
  active_version?: number
}

export interface MediaScenePackRepository {
  createPack(input: CreateMediaScenePackInput): Promise<MediaScenePack>
  findPackBySceneId(sceneId: string): Promise<MediaScenePack | null>
  updatePack(id: string, patch: UpdateMediaScenePackPatch): Promise<MediaScenePack | null>
  listWithVersions(): Promise<MediaScenePackWithVersions[]>
  findWithVersionsBySceneId(sceneId: string): Promise<MediaScenePackWithVersions | null>
  createVersion(input: CreateMediaScenePackVersionInput): Promise<MediaScenePackVersion>
  findVersion(sceneId: string, version: number): Promise<MediaScenePackVersion | null>
  updateVersion(id: string, patch: UpdateMediaScenePackVersionPatch): Promise<MediaScenePackVersion | null>
  updateVersionStatuses(
    packId: string,
    status: MediaScenePackVersionStatus,
    patch: UpdateMediaScenePackVersionPatch,
    options?: { except_version?: number },
  ): Promise<number>
}

let counter = 0
function cuid(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now()}_${counter}`
}

function sortVersions(versions: MediaScenePackVersion[]): MediaScenePackVersion[] {
  return [...versions].sort((left, right) => right.version - left.version)
}

function toWithVersions(
  pack: MediaScenePack,
  versions: MediaScenePackVersion[],
): MediaScenePackWithVersions {
  const sorted = sortVersions(versions)
  return {
    ...pack,
    versions: sorted,
    active_version_record:
      sorted.find((version) =>
        version.version === pack.active_version && version.status === 'active') ?? null,
  }
}

export class InMemoryMediaScenePackRepository implements MediaScenePackRepository {
  private readonly packs = new Map<string, MediaScenePack>()
  private readonly versions = new Map<string, MediaScenePackVersion>()

  async createPack(input: CreateMediaScenePackInput): Promise<MediaScenePack> {
    const now = new Date()
    const entity: MediaScenePack = {
      id: input.id ?? cuid('media_scene_pack'),
      scene_id: input.scene_id,
      display_name: input.display_name,
      media_family: input.media_family,
      status: input.status ?? 'active',
      active_version: input.active_version ?? 1,
      created_at: now,
      updated_at: now,
    }
    this.packs.set(entity.id, entity)
    return entity
  }

  async findPackBySceneId(sceneId: string): Promise<MediaScenePack | null> {
    return Array.from(this.packs.values()).find((pack) => pack.scene_id === sceneId) ?? null
  }

  async updatePack(id: string, patch: UpdateMediaScenePackPatch): Promise<MediaScenePack | null> {
    const current = this.packs.get(id)
    if (!current) return null
    if (patch.display_name !== undefined) current.display_name = patch.display_name
    if (patch.media_family !== undefined) current.media_family = patch.media_family
    if (patch.status !== undefined) current.status = patch.status
    if (patch.active_version !== undefined) current.active_version = patch.active_version
    current.updated_at = new Date()
    return current
  }

  async listWithVersions(): Promise<MediaScenePackWithVersions[]> {
    return Array.from(this.packs.values())
      .sort((left, right) => left.scene_id.localeCompare(right.scene_id))
      .map((pack) => toWithVersions(
        pack,
        Array.from(this.versions.values()).filter((version) => version.pack_id === pack.id),
      ))
  }

  async findWithVersionsBySceneId(sceneId: string): Promise<MediaScenePackWithVersions | null> {
    const pack = await this.findPackBySceneId(sceneId)
    if (!pack) return null
    return toWithVersions(
      pack,
      Array.from(this.versions.values()).filter((version) => version.pack_id === pack.id),
    )
  }

  async createVersion(input: CreateMediaScenePackVersionInput): Promise<MediaScenePackVersion> {
    const now = new Date()
    const entity: MediaScenePackVersion = {
      id: input.id ?? cuid('media_scene_pack_version'),
      pack_id: input.pack_id,
      scene_id: input.scene_id,
      version: input.version,
      status: input.status ?? 'draft',
      display_name: input.display_name,
      media_family: input.media_family,
      when_to_use: [...input.when_to_use],
      do_not_use_when: [...input.do_not_use_when],
      visual_contract: { ...input.visual_contract },
      safety_boundaries: { ...input.safety_boundaries },
      prompt_system: input.prompt_system,
      quality_gate: { ...input.quality_gate },
      created_by_user_id: input.created_by_user_id ?? null,
      activated_at: input.activated_at ?? null,
      released_at: input.released_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.versions.set(entity.id, entity)
    return entity
  }

  async findVersion(sceneId: string, version: number): Promise<MediaScenePackVersion | null> {
    return Array.from(this.versions.values()).find((item) =>
      item.scene_id === sceneId && item.version === version) ?? null
  }

  async updateVersion(
    id: string,
    patch: UpdateMediaScenePackVersionPatch,
  ): Promise<MediaScenePackVersion | null> {
    const current = this.versions.get(id)
    if (!current) return null
    if (patch.status !== undefined) current.status = patch.status
    if (patch.display_name !== undefined) current.display_name = patch.display_name
    if (patch.media_family !== undefined) current.media_family = patch.media_family
    if (patch.when_to_use !== undefined) current.when_to_use = [...patch.when_to_use]
    if (patch.do_not_use_when !== undefined) current.do_not_use_when = [...patch.do_not_use_when]
    if (patch.visual_contract !== undefined) current.visual_contract = { ...patch.visual_contract }
    if (patch.safety_boundaries !== undefined) current.safety_boundaries = { ...patch.safety_boundaries }
    if (patch.prompt_system !== undefined) current.prompt_system = patch.prompt_system
    if (patch.quality_gate !== undefined) current.quality_gate = { ...patch.quality_gate }
    if (patch.created_by_user_id !== undefined) current.created_by_user_id = patch.created_by_user_id
    if (patch.activated_at !== undefined) current.activated_at = patch.activated_at
    if (patch.released_at !== undefined) current.released_at = patch.released_at
    current.updated_at = new Date()
    return current
  }

  async updateVersionStatuses(
    packId: string,
    status: MediaScenePackVersionStatus,
    patch: UpdateMediaScenePackVersionPatch,
    options?: { except_version?: number },
  ): Promise<number> {
    let count = 0
    for (const version of this.versions.values()) {
      if (version.pack_id !== packId || version.status !== status) continue
      if (options?.except_version !== undefined && version.version === options.except_version) continue
      await this.updateVersion(version.id, patch)
      count += 1
    }
    return count
  }
}
