import { createHash, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { LookupAddress } from 'node:dns'
import type {
  MediaAsset,
  MediaContextProjection,
  MediaSemanticSnapshot,
  MediaSemanticSummary,
  PrivateMediaMemoryProjection,
  PrivateMediaRuntimeCard,
  PrivateMessageAttachment,
  PublicReuseHandoffCard,
  SceneMediaBinding,
} from '../repos/types.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { StorageAdapter } from '../services/storage-adapter.js'
import { ValidationError } from '../lib/errors.js'
import { MediaSemanticService, buildFallbackMediaSemanticSummary } from './media-semantic-service.js'
import { MediaBindingService, buildOwnerPrivatePoolSceneId } from './media-binding-service.js'
import { MediaProjectionService } from './media-projection-service.js'
import { MediaWriteBridge } from './media-write-bridge.js'
import { pickModelReachableMediaUrl, resolveMediaAssetUrl } from './media-url.js'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const URL_PREFLIGHT_TIMEOUT_MS = 10_000
const URL_PREFLIGHT_MAX_REDIRECTS = 5
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GIF87A_SIGNATURE = Buffer.from('GIF87a', 'ascii')
const GIF89A_SIGNATURE = Buffer.from('GIF89a', 'ascii')
const RIFF_SIGNATURE = Buffer.from('RIFF', 'ascii')
const WEBP_SIGNATURE = Buffer.from('WEBP', 'ascii')

interface MediaAssetRecord {
  asset: MediaAsset
  snapshot: MediaSemanticSnapshot | null
  owner_note: string | null
  media_url: string
  latest_post_id: string | null
  created_at: Date
}

export interface OwnerPoolCurrentState {
  pool: {
    anchor_scene_id: string
    active_count: number
    latest_asset: MediaAssetRecord | null
  }
  latest_public_attachment: MediaAssetRecord | null
}

export interface ScheduledMediaCandidate {
  id: string
  media_url: string
  mime_type: string
}

export interface GeneratedMediaRecord {
  asset: MediaAsset
  snapshot: MediaSemanticSnapshot
  media_url: string
}

export interface MediaAssetServiceDeps {
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  storage: StorageAdapter
  mediaSemanticService: MediaSemanticService
  mediaBindingService: MediaBindingService
  mediaProjectionService: MediaProjectionService
  mediaWriteBridge: MediaWriteBridge
}

interface DownloadedRemoteMedia {
  source_url: string
  mime_type: string
  bytes: Buffer
}

export class MediaAssetService {
  constructor(private readonly deps: MediaAssetServiceDeps) {}

  async ingestOwnerUpload(input: {
    agent_id: string
    owner_user_id: string
    owner_note: string | null
    mime_type: string
    bytes: Buffer
  }): Promise<MediaAssetRecord> {
    const normalizedMimeType = input.mime_type.toLowerCase()
    this.assertMimeType(normalizedMimeType)
    this.assertSize(input.bytes.byteLength)
    this.assertImageSignature(normalizedMimeType, input.bytes)

    const dimensions = this.readImageDimensions(normalizedMimeType, input.bytes)
    const stored = await this.storeBytes({
      agent_id: input.agent_id,
      mime_type: normalizedMimeType,
      bytes: input.bytes,
    })
    const semantic = await this.deps.mediaSemanticService.extract({
      agentId: input.agent_id,
      mimeType: normalizedMimeType,
      sourceUrl: pickModelReachableMediaUrl(stored.url),
      uploadBuffer: input.bytes,
    })

    return this.createOwnerPoolRecord({
      id: undefined,
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      owner_note: input.owner_note,
      source_kind: 'owner_console_upload',
      origin_url: null,
      storage_key: stored.key,
      mime_type: normalizedMimeType,
      file_size_bytes: input.bytes.byteLength,
      width: dimensions.width,
      height: dimensions.height,
      sha256: createHash('sha256').update(input.bytes).digest('hex'),
      phash: null,
      semantic,
      media_url: stored.url,
    })
  }

  async ingestOwnerUrl(input: {
    agent_id: string
    owner_user_id: string
    source_url: string
    owner_note: string | null
  }): Promise<MediaAssetRecord> {
    const downloaded = await this.downloadRemoteImage(this.requireHttpsUrl(input.source_url))
    const dimensions = this.readImageDimensions(downloaded.mime_type, downloaded.bytes)
    const stored = await this.storeBytes({
      agent_id: input.agent_id,
      mime_type: downloaded.mime_type,
      bytes: downloaded.bytes,
    })
    const semantic = await this.deps.mediaSemanticService.extract({
      agentId: input.agent_id,
      mimeType: downloaded.mime_type,
      sourceUrl: pickModelReachableMediaUrl(stored.url, downloaded.source_url),
      uploadBuffer: downloaded.bytes,
    })

    return this.createOwnerPoolRecord({
      id: undefined,
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      owner_note: input.owner_note,
      source_kind: 'url_import',
      origin_url: downloaded.source_url,
      storage_key: stored.key,
      mime_type: downloaded.mime_type,
      file_size_bytes: downloaded.bytes.byteLength,
      width: dimensions.width,
      height: dimensions.height,
      sha256: createHash('sha256').update(downloaded.bytes).digest('hex'),
      phash: null,
      semantic,
      media_url: stored.url,
    })
  }

  async ingestPrivateMessageUpload(input: {
    agent_id: string
    owner_user_id: string
    session_id: string
    mime_type: string
    bytes: Buffer
  }): Promise<MediaAssetRecord> {
    const normalizedMimeType = input.mime_type.toLowerCase()
    this.assertMimeType(normalizedMimeType)
    this.assertSize(input.bytes.byteLength)
    this.assertImageSignature(normalizedMimeType, input.bytes)

    const dimensions = this.readImageDimensions(normalizedMimeType, input.bytes)
    const stored = await this.storeBytes({
      agent_id: input.agent_id,
      mime_type: normalizedMimeType,
      bytes: input.bytes,
    })
    const semantic = await this.deps.mediaSemanticService.extract({
      agentId: input.agent_id,
      mimeType: normalizedMimeType,
      sourceUrl: pickModelReachableMediaUrl(stored.url),
      uploadBuffer: input.bytes,
    })

    const asset = await this.deps.mediaAssetRepo.create({
      steward_agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      source_kind: 'private_message_upload',
      source_scene_type: 'private_session',
      source_scene_id: input.session_id,
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      storage_key: stored.key,
      origin_url: null,
      mime_type: normalizedMimeType,
      file_size_bytes: input.bytes.byteLength,
      width: dimensions.width,
      height: dimensions.height,
      sha256: createHash('sha256').update(input.bytes).digest('hex'),
      phash: null,
    })
    const snapshot = await this.createCurrentSnapshot(asset.id, semantic)
    return {
      asset,
      snapshot,
      owner_note: null,
      media_url: stored.url,
      latest_post_id: null,
      created_at: asset.created_at,
    }
  }

  async attachAssetToPrivateMessage(input: {
    asset_id: string
    agent_id: string
    owner_user_id: string
    session_id: string
    message_id: string
    why_relevant_hint: string
  }): Promise<{
    attachment: PrivateMessageAttachment
    binding: SceneMediaBinding
    runtime_projection: MediaContextProjection
    runtime_card: PrivateMediaRuntimeCard
    runtime_serialized_text: string
    public_reuse_handoff_projection: MediaContextProjection
    public_reuse_handoff: PublicReuseHandoffCard
    memory_projection: MediaContextProjection
    memory_payload: PrivateMediaMemoryProjection
  }> {
    const asset = await this.deps.mediaAssetRepo.findById(input.asset_id)
    if (!asset) {
      throw new ValidationError('attachment_asset_ids contains an unknown asset')
    }
    this.assertPrivateMessageAssetEligibility(asset, input)

    const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
    if (!snapshot) {
      throw new ValidationError('attachment semantic snapshot is not ready')
    }

    const existingBinding = (await this.deps.sceneMediaBindingRepo.findByScene('private_message', input.message_id))
      .find((binding) => binding.asset_id === asset.id) ?? null
    const binding = existingBinding ?? await this.deps.mediaBindingService.createPrivateMessageBinding({
      asset,
      snapshot,
      messageId: input.message_id,
      createdById: input.owner_user_id,
    })

    const projections = await this.deps.mediaContextProjectionRepo.findByBindingId(binding.id)
    const existingRuntimeProjection = projections.find(
      (projection) =>
        projection.projection_surface === 'private_runtime'
        && projection.projection_kind === 'private_media_runtime_card'
        && projection.schema_version === 'private-media-runtime-card.v1',
    ) ?? null
    const runtimeResult = existingRuntimeProjection
      ? {
          projection: existingRuntimeProjection,
          card: existingRuntimeProjection.payload_json as unknown as PrivateMediaRuntimeCard,
          serialized_text: this.deps.mediaProjectionService.serializePrivateRuntimeCardForPrompt({
            card: existingRuntimeProjection.payload_json as unknown as PrivateMediaRuntimeCard,
            max_chars: 900,
          }).text,
        }
      : await this.deps.mediaProjectionService.createPrivateRuntimeProjection({
          binding,
          asset,
          snapshot,
          source_kind: asset.source_kind,
          why_relevant_hint: input.why_relevant_hint,
        }).then((result) => ({
          projection: result.projection,
          card: result.card,
          serialized_text: result.serialized.text,
        }))

    const existingMemoryProjection = projections.find(
      (projection) =>
        projection.projection_surface === 'memory'
        && projection.projection_kind === 'private_media_memory_projection'
        && projection.schema_version === 'private-media-memory-projection.v1',
    ) ?? null
    const memoryResult = existingMemoryProjection
      ? {
          projection: existingMemoryProjection,
          payload: existingMemoryProjection.payload_json as unknown as PrivateMediaMemoryProjection,
        }
      : await this.deps.mediaProjectionService.createPrivateMemoryProjection({
          binding,
          asset,
          snapshot,
          agent_id: input.agent_id,
          owner_user_id: input.owner_user_id,
          session_id: input.session_id,
          why_relevant_hint: input.why_relevant_hint,
        })

    const existingPublicReuseHandoff = projections.find(
      (projection) =>
        projection.projection_surface === 'planner'
        && projection.projection_kind === 'public_reuse_handoff'
        && projection.schema_version === 'public-reuse-handoff.v1',
    ) ?? null
    const publicReuseHandoff = existingPublicReuseHandoff
      ? {
          projection: existingPublicReuseHandoff,
          handoff: existingPublicReuseHandoff.payload_json as unknown as PublicReuseHandoffCard,
        }
      : await this.deps.mediaProjectionService.createPublicReuseHandoffProjection({
          binding,
          asset,
          snapshot,
          source_kind: asset.source_kind,
          why_relevant_hint: input.why_relevant_hint,
          allowed_reuse_modes: ['derive_new', 'reference_only'],
          disclose_origin_policy: 'never',
        })

    return {
      attachment: this.buildPrivateAttachmentView({
        asset,
        snapshot,
        runtimeCard: runtimeResult.card,
      }),
      binding,
      runtime_projection: runtimeResult.projection,
      runtime_card: runtimeResult.card,
      runtime_serialized_text: runtimeResult.serialized_text,
      public_reuse_handoff_projection: publicReuseHandoff.projection,
      public_reuse_handoff: publicReuseHandoff.handoff,
      memory_projection: memoryResult.projection,
      memory_payload: memoryResult.payload,
    }
  }

  async getPrivateAttachmentView(assetId: string): Promise<PrivateMessageAttachment | null> {
    const asset = await this.deps.mediaAssetRepo.findById(assetId)
    if (!asset) return null
    const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
    return this.buildPrivateAttachmentView({ asset, snapshot })
  }

  async ingestGeneratedDerivative(input: {
    agent_id: string
    plan_id?: string | null
    mime_type: string
    bytes: Buffer
    visibility_policy?: MediaAsset['visibility_policy']
    lifecycle_status?: MediaAsset['lifecycle_status']
  }): Promise<GeneratedMediaRecord> {
    const normalizedMimeType = input.mime_type.toLowerCase()
    this.assertMimeType(normalizedMimeType)
    this.assertSize(input.bytes.byteLength)
    this.assertImageSignature(normalizedMimeType, input.bytes)

    const dimensions = this.readImageDimensions(normalizedMimeType, input.bytes)
    const stored = await this.storeBytes({
      agent_id: input.agent_id,
      mime_type: normalizedMimeType,
      bytes: input.bytes,
    })
    const semantic = await this.deps.mediaSemanticService.extract({
      agentId: input.agent_id,
      mimeType: normalizedMimeType,
      sourceUrl: pickModelReachableMediaUrl(stored.url),
      uploadBuffer: input.bytes,
    })
    const asset = await this.deps.mediaAssetRepo.create({
      steward_agent_id: input.agent_id,
      owner_user_id: null,
      source_kind: 'generated',
      source_scene_type: input.plan_id ? 'image_plan' : null,
      source_scene_id: input.plan_id ?? null,
      visibility_policy: input.visibility_policy ?? 'public_original_allowed',
      lifecycle_status: input.lifecycle_status ?? 'active',
      storage_key: stored.key,
      origin_url: null,
      mime_type: normalizedMimeType,
      file_size_bytes: input.bytes.byteLength,
      width: dimensions.width,
      height: dimensions.height,
      sha256: createHash('sha256').update(input.bytes).digest('hex'),
      phash: null,
    })
    const snapshot = await this.createCurrentSnapshot(asset.id, semantic)
    return {
      asset,
      snapshot,
      media_url: stored.url,
    }
  }

  async listPrivateMessageAttachmentViews(messageIds: string[]): Promise<Map<string, PrivateMessageAttachment[]>> {
    const result = new Map<string, PrivateMessageAttachment[]>()
    if (messageIds.length === 0) return result

    const bindings = await this.deps.sceneMediaBindingRepo.findByScenes('private_message', messageIds)
    if (bindings.length === 0) return result

    const assets = await this.deps.mediaAssetRepo.findByIds(bindings.map((binding) => binding.asset_id))
    const assetById = new Map(assets.map((asset) => [asset.id, asset]))
    const snapshots = await Promise.all(
      assets.map(async (asset) => [asset.id, await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)] as const),
    )
    const snapshotByAssetId = new Map(snapshots)
    const projections = await this.deps.mediaContextProjectionRepo.findByBindingIds(bindings.map((binding) => binding.id))
    const runtimeCardByBindingId = new Map<string, PrivateMediaRuntimeCard>()
    for (const projection of projections) {
      if (
        projection.projection_surface === 'private_runtime'
        && projection.projection_kind === 'private_media_runtime_card'
        && projection.schema_version === 'private-media-runtime-card.v1'
      ) {
        runtimeCardByBindingId.set(projection.binding_id, projection.payload_json as unknown as PrivateMediaRuntimeCard)
      }
    }

    for (const binding of bindings) {
      const asset = assetById.get(binding.asset_id)
      if (!asset) continue
      const attachment = this.buildPrivateAttachmentView({
        asset,
        snapshot: snapshotByAssetId.get(asset.id) ?? null,
        runtimeCard: runtimeCardByBindingId.get(binding.id),
      })
      const current = result.get(binding.scene_id) ?? []
      current.push(attachment)
      result.set(binding.scene_id, current)
    }

    return result
  }

  async rollbackPrivateMessageAttachmentArtifacts(messageId: string): Promise<void> {
    const bindings = await this.deps.sceneMediaBindingRepo.findByScene('private_message', messageId)
    if (bindings.length === 0) return
    const bindingIds = bindings.map((binding) => binding.id)
    await this.deps.mediaContextProjectionRepo.deleteByBindingIds(bindingIds)
    await this.deps.sceneMediaBindingRepo.deleteByIds(bindingIds)
  }

  async getCurrentOwnerPoolState(agentId: string): Promise<OwnerPoolCurrentState> {
    const assets = await this.deps.mediaAssetRepo.listByStewardAgentId(agentId)
    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetIds(assets.map((item) => item.id))
    const ownerSceneId = buildOwnerPrivatePoolSceneId(agentId)

    const activePoolAssets = assets.filter((asset) => {
      if (asset.lifecycle_status !== 'active') return false
      return bindings.some(
        (binding) =>
          binding.asset_id === asset.id
          && binding.scene_type === 'memory_card'
          && binding.scene_id === ownerSceneId,
      )
    })

    const latestAsset = activePoolAssets[0]
      ? await this.buildRecord(activePoolAssets[0], bindings.filter((binding) => binding.asset_id === activePoolAssets[0]!.id), {
          ownerSceneId,
          createdAt: activePoolAssets[0]!.created_at,
        })
      : null

    const latestPublicBinding = bindings
      .filter((binding) => binding.scene_type === 'forum_post')
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0] ?? null

    let latestPublicAttachment: MediaAssetRecord | null = null
    if (latestPublicBinding) {
      const latestPublicAsset = assets.find((asset) => asset.id === latestPublicBinding.asset_id) ?? null
      const projectionMediaUrl = await this.resolveProjectionMediaUrl(
        latestPublicBinding.id,
        'public_display',
        'display_attachment',
      )
      latestPublicAttachment = await this.buildRecord(
        latestPublicAsset,
        bindings.filter((binding) => binding.asset_id === latestPublicBinding.asset_id),
        {
          ownerSceneId,
          latestPostId: latestPublicBinding.scene_id,
          createdAt: latestPublicBinding.created_at,
          mediaUrlOverride: projectionMediaUrl,
        },
      )
    }

    return {
      pool: {
        anchor_scene_id: ownerSceneId,
        active_count: activePoolAssets.length,
        latest_asset: latestAsset,
      },
      latest_public_attachment: latestPublicAttachment,
    }
  }

  async archiveLatestOwnerPoolAsset(agentId: string): Promise<boolean> {
    const assets = await this.deps.mediaAssetRepo.listByStewardAgentId(agentId, {
      lifecycle_statuses: ['active'],
    })
    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetIds(assets.map((item) => item.id))
    const ownerSceneId = buildOwnerPrivatePoolSceneId(agentId)
    const latest = assets.find((asset) =>
      bindings.some((binding) => binding.asset_id === asset.id && binding.scene_type === 'memory_card' && binding.scene_id === ownerSceneId),
    )
    if (!latest) return false
    await this.deps.mediaAssetRepo.update(latest.id, { lifecycle_status: 'archived' })
    return true
  }

  async listEligibleOwnerPoolAgentIds(limit = 100): Promise<string[]> {
    const stewardAgentIds = await this.deps.mediaAssetRepo.listStewardAgentIdsWithAssets({
      lifecycle_statuses: ['active'],
    })
    const eligible: string[] = []
    for (const agentId of stewardAgentIds) {
      const candidate = await this.getLatestEligibleOwnerPoolAsset(agentId)
      if (!candidate) continue
      eligible.push(agentId)
      if (eligible.length >= limit) break
    }
    return eligible
  }

  async getLatestEligibleOwnerPoolAsset(agentId: string): Promise<ScheduledMediaCandidate | null> {
    const assets = await this.deps.mediaAssetRepo.listByStewardAgentId(agentId, {
      lifecycle_statuses: ['active'],
    })
    if (assets.length === 0) return null
    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetIds(assets.map((item) => item.id))
    const ownerSceneId = buildOwnerPrivatePoolSceneId(agentId)

    for (const asset of assets) {
      const mediaUrl = resolveMediaAssetUrl(asset, this.deps.storage)
      if (!mediaUrl || asset.visibility_policy === 'blocked') continue
      const assetBindings = bindings.filter((binding) => binding.asset_id === asset.id)
      const inOwnerPool = assetBindings.some(
        (binding) => binding.scene_type === 'memory_card' && binding.scene_id === ownerSceneId,
      )
      const alreadyAttachedToPost = assetBindings.some((binding) => binding.scene_type === 'forum_post')
      if (!inOwnerPool || alreadyAttachedToPost) continue
      return {
        id: asset.id,
        media_url: mediaUrl,
        mime_type: asset.mime_type,
      }
    }
    return null
  }

  attachAssetToForumPost(input: {
    asset_id: string
    post_id: string
  }): Promise<{ linked: boolean }> {
    return this.deps.mediaWriteBridge.attachAssetToPost(input)
  }

  async getAssetMediaFile(assetId: string): Promise<{
    mime_type: string
    data: Buffer
  } | null> {
    const asset = await this.deps.mediaAssetRepo.findById(assetId)
    if (!asset?.storage_key) return null
    const object = await this.deps.storage.getObject(asset.storage_key)
    if (!object) return null
    return {
      mime_type: asset.mime_type,
      data: object.data,
    }
  }

  async getStoredMediaByKey(storageKey: string): Promise<{
    mime_type: string
    data: Buffer
  } | null> {
    const object = await this.deps.storage.getObject(storageKey)
    if (!object) return null
    return {
      mime_type: object.contentType,
      data: object.data,
    }
  }

  async getAssetById(assetId: string): Promise<MediaAsset | null> {
    return this.deps.mediaAssetRepo.findById(assetId)
  }

  private async createOwnerPoolRecord(input: {
    id?: string
    agent_id: string
    owner_user_id: string
    owner_note: string | null
    source_kind: MediaAsset['source_kind']
    origin_url: string | null
    storage_key: string | null
    mime_type: string
    file_size_bytes: number
    width: number | null
    height: number | null
    sha256: string
    phash: string | null
    semantic: Awaited<ReturnType<MediaSemanticService['extract']>>
    media_url: string
  }): Promise<MediaAssetRecord> {
    const asset = await this.deps.mediaAssetRepo.create({
      ...(input.id ? { id: input.id } : {}),
      steward_agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      source_kind: input.source_kind,
      visibility_policy: 'private_only',
      lifecycle_status: 'active',
      storage_key: input.storage_key,
      origin_url: input.origin_url,
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      width: input.width,
      height: input.height,
      sha256: input.sha256,
      phash: input.phash,
    })
    const snapshot = await this.createCurrentSnapshot(asset.id, input.semantic)
    const ownerPoolBinding = await this.deps.mediaBindingService.createOwnerPoolAnchor({
      asset,
      snapshot,
      ownerNote: input.owner_note,
      ownerUserId: input.owner_user_id,
    })
    await this.deps.mediaProjectionService.createRetrievalCaptionProjection({
      binding: ownerPoolBinding,
      asset,
      snapshot,
      mediaUrl: input.media_url,
      ownerNote: input.owner_note,
    })
    return {
      asset,
      snapshot,
      owner_note: input.owner_note,
      media_url: input.media_url,
      latest_post_id: null,
      created_at: asset.created_at,
    }
  }

  private async createCurrentSnapshot(
    assetId: string,
    semantic: Awaited<ReturnType<MediaSemanticService['extract']>>,
  ): Promise<MediaSemanticSnapshot> {
    await this.deps.mediaSemanticSnapshotRepo.clearCurrentByAssetId(assetId)
    return this.deps.mediaSemanticSnapshotRepo.create({
      asset_id: assetId,
      snapshot_kind: 'visual_core',
      schema_version: semantic.schema_version,
      model_provider: semantic.model_provider,
      model_name: semantic.model_name,
      model_version: semantic.model_version,
      summary: semantic.summary,
      extraction_status: semantic.extraction_status,
      quality_grade: semantic.quality_grade,
      is_current: true,
    })
  }

  private async buildRecord(
    asset: MediaAsset | null,
    bindings: SceneMediaBinding[],
    options: {
      ownerSceneId?: string
      latestPostId?: string | null
      createdAt?: Date
      mediaUrlOverride?: string | null
    } = {},
  ): Promise<MediaAssetRecord | null> {
    if (!asset) return null
    const mediaUrl = options.mediaUrlOverride ?? resolveMediaAssetUrl(asset, this.deps.storage)
    if (!mediaUrl) return null
    const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
    const ownerBinding = bindings.find(
      (binding) =>
        binding.scene_type === 'memory_card'
        && (!options.ownerSceneId || binding.scene_id === options.ownerSceneId),
    ) ?? null
    return {
      asset,
      snapshot,
      owner_note: ownerBinding?.binding_note_text ?? null,
      media_url: mediaUrl,
      latest_post_id: options.latestPostId ?? null,
      created_at: options.createdAt ?? asset.created_at,
    }
  }

  private buildPrivateAttachmentView(input: {
    asset: MediaAsset
    snapshot: MediaSemanticSnapshot | null
    runtimeCard?: PrivateMediaRuntimeCard | null
  }): PrivateMessageAttachment {
    const mediaUrl = resolveMediaAssetUrl(input.asset, this.deps.storage)
    const summary = MediaAssetService.readSummaryOrFallback(input.snapshot, input.asset.mime_type)
    const altText = trimCompact(
      input.runtimeCard?.private_summary.private_safe_caption
      ?? summary.public_safe_summary
      ?? [summary.theme, summary.scene, summary.mood].filter(Boolean).join(', '),
      180,
    ) || '私聊图片附件'
    const available = input.asset.lifecycle_status === 'active'
      && input.asset.visibility_policy !== 'blocked'
      && Boolean(mediaUrl)

    return {
      asset_id: input.asset.id,
      display_variant: available ? 'original' : 'placeholder',
      display_url: available ? mediaUrl : null,
      placeholder: available
        ? null
        : {
            kind: 'asset_unavailable',
            label: '图片暂不可用',
          },
      mime_type: input.asset.mime_type,
      alt_text: altText,
      width: input.asset.width,
      height: input.asset.height,
      state: available ? 'ready' : 'unavailable',
    }
  }

  private async resolveProjectionMediaUrl(
    bindingId: string,
    projectionSurface: 'public_display' | 'retrieval',
    projectionKind: 'display_attachment' | 'retrieval_caption',
  ): Promise<string | null> {
    const projections = await this.deps.mediaContextProjectionRepo.findByBindingId(bindingId)
    const projection = projections.find(
      (item) => item.projection_surface === projectionSurface && item.projection_kind === projectionKind,
    )
    const mediaUrl = projection?.payload_json?.media_url
    return typeof mediaUrl === 'string' && mediaUrl.trim() ? mediaUrl : null
  }

  private assertPrivateMessageAssetEligibility(
    asset: MediaAsset,
    input: {
      agent_id: string
      owner_user_id: string
      session_id: string
    },
  ): void {
    if (asset.steward_agent_id !== input.agent_id || asset.owner_user_id !== input.owner_user_id) {
      throw new ValidationError('attachment asset does not belong to this private chat')
    }
    if (asset.source_kind !== 'private_message_upload') {
      throw new ValidationError('attachment asset must come from private chat upload staging')
    }
    if (asset.source_scene_type !== 'private_session') {
      throw new ValidationError('attachment asset is missing private session provenance')
    }
    if (asset.source_scene_id !== input.session_id) {
      throw new ValidationError('attachment asset is staged for a different private session')
    }
    if (asset.lifecycle_status !== 'active') {
      throw new ValidationError('attachment asset is no longer active')
    }
    if (asset.visibility_policy !== 'private_only') {
      throw new ValidationError('attachment asset is not private-only')
    }
  }

  private async storeBytes(input: {
    agent_id: string
    mime_type: string
    bytes: Buffer
  }): Promise<{ key: string; url: string }> {
    const key = `${input.agent_id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${this.extensionFromMime(input.mime_type)}`
    const stored = await this.deps.storage.putObject({
      key,
      data: input.bytes,
      contentType: input.mime_type,
    })
    return { key: stored.key, url: stored.url }
  }

  private requireHttpsUrl(raw: string): string {
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      throw new ValidationError('source_url must be a valid URL')
    }
    if (parsed.protocol !== 'https:') {
      throw new ValidationError('source_url must use https')
    }
    if (this.isBlockedHostname(parsed.hostname)) {
      throw new ValidationError('source_url host is not allowed')
    }
    return parsed.toString()
  }

  private async downloadRemoteImage(sourceUrl: string): Promise<DownloadedRemoteMedia> {
    let meta: { mime_type: string; file_size_bytes: number }
    try {
      const { response } = await this.fetchWithValidatedRedirects(sourceUrl, { method: 'HEAD' })
      if (!response.ok) {
        throw new ValidationError(`source_url preflight failed with status ${response.status}`)
      }
      meta = this.extractRemoteImageMeta(response.headers)
    } catch {
      const { response } = await this.fetchWithValidatedRedirects(sourceUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      })
      if (!response.ok) {
        throw new ValidationError(`source_url preflight failed with status ${response.status}`)
      }
      meta = this.extractRemoteImageMeta(response.headers)
    }

    const { response, resolvedUrl } = await this.fetchWithValidatedRedirects(sourceUrl, { method: 'GET' })
    if (!response.ok) {
      throw new ValidationError(`source_url fetch failed with status ${response.status}`)
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    this.assertSize(bytes.byteLength)
    if (bytes.byteLength > meta.file_size_bytes) {
      this.assertSize(bytes.byteLength)
    }
    this.assertImageSignature(meta.mime_type, bytes)
    return {
      source_url: resolvedUrl,
      mime_type: meta.mime_type,
      bytes,
    }
  }

  private assertMimeType(mimeType: string): void {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new ValidationError('unsupported media type')
    }
  }

  private assertSize(size: number): void {
    if (!Number.isFinite(size) || size <= 0) {
      throw new ValidationError('invalid media size')
    }
    if (size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError('media exceeds 10MB limit')
    }
  }

  private assertImageSignature(mimeType: string, bytes: Buffer): void {
    const lower = mimeType.toLowerCase()
    if (lower === 'image/png') {
      if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        throw new ValidationError('corrupted image file')
      }
      return
    }
    if (lower === 'image/gif') {
      if (bytes.length < GIF87A_SIGNATURE.length) {
        throw new ValidationError('corrupted image file')
      }
      const head = bytes.subarray(0, GIF87A_SIGNATURE.length)
      if (!head.equals(GIF87A_SIGNATURE) && !head.equals(GIF89A_SIGNATURE)) {
        throw new ValidationError('corrupted image file')
      }
      return
    }
    if (lower === 'image/webp') {
      if (
        bytes.length < 12
        || !bytes.subarray(0, 4).equals(RIFF_SIGNATURE)
        || !bytes.subarray(8, 12).equals(WEBP_SIGNATURE)
      ) {
        throw new ValidationError('corrupted image file')
      }
      return
    }
    if ((lower === 'image/jpeg' || lower === 'image/jpg') && (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)) {
      throw new ValidationError('corrupted image file')
    }
  }

  private extensionFromMime(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg'
      case 'image/png':
        return '.png'
      case 'image/webp':
        return '.webp'
      case 'image/gif':
        return '.gif'
      default:
        return ''
    }
  }

  private async fetchWithValidatedRedirects(
    sourceUrl: string,
    init: {
      method: 'HEAD' | 'GET'
      headers?: Record<string, string>
    },
  ): Promise<{ response: Response; resolvedUrl: string }> {
    let currentUrl = sourceUrl
    for (let hop = 0; hop <= URL_PREFLIGHT_MAX_REDIRECTS; hop += 1) {
      await this.assertRemoteUrlSafe(currentUrl)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), URL_PREFLIGHT_TIMEOUT_MS)
      try {
        const response = await fetch(currentUrl, {
          method: init.method,
          headers: init.headers,
          redirect: 'manual',
          signal: controller.signal,
        })
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location) {
            throw new ValidationError('source_url redirect is missing location')
          }
          const nextUrl = new URL(location, currentUrl)
          if (nextUrl.protocol !== 'https:') {
            throw new ValidationError('source_url must use https')
          }
          currentUrl = nextUrl.toString()
          continue
        }
        return { response, resolvedUrl: currentUrl }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new ValidationError('source_url preflight timeout')
        }
        throw err
      } finally {
        clearTimeout(timer)
      }
    }
    throw new ValidationError('source_url has too many redirects')
  }

  private async assertRemoteUrlSafe(rawUrl: string): Promise<void> {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') {
      throw new ValidationError('source_url must use https')
    }
    if (this.isBlockedHostname(parsed.hostname)) {
      throw new ValidationError('source_url host is not allowed')
    }
    if (isIP(parsed.hostname) !== 0) return

    const addresses = await lookup(parsed.hostname, { all: true, verbatim: true }).catch(() => [] as LookupAddress[])
    if (addresses.length === 0) {
      throw new ValidationError('source_url host cannot be resolved')
    }
    for (const item of addresses) {
      if (this.isPrivateAddress(item.address)) {
        throw new ValidationError('source_url resolves to private network')
      }
    }
  }

  private extractRemoteImageMeta(headers: Headers): { mime_type: string; file_size_bytes: number } {
    const mimeType = (headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    this.assertMimeType(mimeType)
    const size = this.extractImageSize(headers)
    this.assertSize(size)
    return {
      mime_type: mimeType,
      file_size_bytes: size,
    }
  }

  private extractImageSize(headers: Headers): number {
    const range = headers.get('content-range')
    if (range) {
      const match = range.match(/\/(\d+)$/)
      if (match) {
        const total = Number(match[1])
        if (Number.isFinite(total) && total > 0) {
          return total
        }
      }
    }
    const sizeRaw = headers.get('content-length')
    if (sizeRaw) {
      const size = Number(sizeRaw)
      if (Number.isFinite(size) && size > 0) {
        return size
      }
    }
    throw new ValidationError('invalid media size')
  }

  private isBlockedHostname(hostname: string): boolean {
    const lower = hostname.toLowerCase()
    if (lower === 'localhost' || lower.endsWith('.localhost')) return true
    if (lower.endsWith('.local')) return true
    if (isIP(lower) !== 0) return this.isPrivateAddress(lower)
    return false
  }

  private isPrivateAddress(address: string): boolean {
    if (isIP(address) === 4) {
      if (address.startsWith('10.')) return true
      if (address.startsWith('127.')) return true
      if (address.startsWith('192.168.')) return true
      const second = Number(address.split('.')[1] ?? '0')
      if (address.startsWith('172.') && second >= 16 && second <= 31) return true
      if (address.startsWith('169.254.')) return true
      return false
    }
    if (isIP(address) === 6) {
      const lower = address.toLowerCase()
      if (lower === '::1') return true
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true
      if (lower.startsWith('fe80:')) return true
      return false
    }
    return false
  }

  private readImageDimensions(
    mimeType: string,
    bytes: Buffer,
  ): { width: number | null; height: number | null } {
    try {
      if (mimeType === 'image/png' && bytes.length >= 24) {
        return {
          width: bytes.readUInt32BE(16),
          height: bytes.readUInt32BE(20),
        }
      }
      if (mimeType === 'image/gif' && bytes.length >= 10) {
        return {
          width: bytes.readUInt16LE(6),
          height: bytes.readUInt16LE(8),
        }
      }
      if (mimeType === 'image/webp' && bytes.length >= 30) {
        const chunkType = bytes.subarray(12, 16).toString('ascii')
        if (chunkType === 'VP8X') {
          return {
            width: 1 + bytes.readUIntLE(24, 3),
            height: 1 + bytes.readUIntLE(27, 3),
          }
        }
      }
      if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        let offset = 2
        while (offset + 9 < bytes.length) {
          if (bytes[offset] !== 0xff) {
            offset += 1
            continue
          }
          const marker = bytes[offset + 1]
          const length = bytes.readUInt16BE(offset + 2)
          const isSofMarker = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
          if (isSofMarker && offset + 8 < bytes.length) {
            return {
              height: bytes.readUInt16BE(offset + 5),
              width: bytes.readUInt16BE(offset + 7),
            }
          }
          offset += 2 + length
        }
      }
    } catch {
      return { width: null, height: null }
    }
    return { width: null, height: null }
  }

  static readSummaryOrFallback(snapshot: MediaSemanticSnapshot | null, mimeType: string): MediaSemanticSummary {
    return snapshot?.summary ?? buildFallbackMediaSemanticSummary(mimeType, 'legacy')
  }
}

function trimCompact(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
}
