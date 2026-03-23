import type { AgentRepository } from '../repos/agent-repository.js'
import type { MediaLifecycleStatus, MediaSemanticSummary, MediaVisibilityPolicy } from '../repos/types.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { MediaAssetService, type ScheduledMediaCandidate } from '../media/media-asset-service.js'
import type { MediaReuseGovernanceService } from '../media/media-reuse-governance-service.js'

export interface InclinationAssetView {
  asset_id: string
  visibility_policy: MediaVisibilityPolicy
  lifecycle_status: MediaLifecycleStatus
  media_url: string
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  owner_note: string | null
  semantic_summary: MediaSemanticSummary
  created_at: string
  latest_post_id: string | null
}

export interface InclinationAssetCurrentState {
  pool: {
    anchor_scene_id: string
    active_count: number
    latest_asset: InclinationAssetView | null
  }
  latest_public_attachment: InclinationAssetView | null
}

export { ScheduledMediaCandidate }

export class InclinationAssetService {
  constructor(
    private readonly deps: {
      agentRepo: AgentRepository
      mediaAssetService: MediaAssetService
      mediaReuseGovernanceService: MediaReuseGovernanceService
    },
  ) {}

  async createFromUrl(input: {
    agent_id: string
    owner_user_id: string
    source_url: string
    owner_note?: string
  }): Promise<InclinationAssetView> {
    this.assertOwner(input.agent_id, input.owner_user_id)
    const record = await this.deps.mediaAssetService.ingestOwnerUrl({
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      source_url: input.source_url,
      owner_note: this.normalizeOwnerNote(input.owner_note),
    })
    return this.toView(record)
  }

  async createFromUpload(input: {
    agent_id: string
    owner_user_id: string
    owner_note?: string
    original_name?: string
    mime_type: string
    bytes: Buffer
  }): Promise<InclinationAssetView> {
    this.assertOwner(input.agent_id, input.owner_user_id)
    const record = await this.deps.mediaAssetService.ingestOwnerUpload({
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      owner_note: this.normalizeOwnerNote(input.owner_note),
      mime_type: input.mime_type,
      bytes: input.bytes,
    })
    return this.toView(record)
  }

  async getCurrent(agentId: string, ownerUserId: string): Promise<InclinationAssetCurrentState> {
    this.assertOwner(agentId, ownerUserId)
    const state = await this.deps.mediaAssetService.getCurrentOwnerPoolState(agentId)
    return {
      pool: {
        anchor_scene_id: state.pool.anchor_scene_id,
        active_count: state.pool.active_count,
        latest_asset: state.pool.latest_asset ? this.toView(state.pool.latest_asset) : null,
      },
      latest_public_attachment: state.latest_public_attachment
        ? this.toView(state.latest_public_attachment)
        : null,
    }
  }

  async cancelCurrent(agentId: string, ownerUserId: string): Promise<{ removed: boolean }> {
    this.assertOwner(agentId, ownerUserId)
    const removed = await this.deps.mediaAssetService.archiveLatestOwnerPoolAsset(agentId)
    return { removed }
  }

  async promoteAsset(input: {
    agent_id: string
    owner_user_id: string
    asset_id: string
  }): Promise<InclinationAssetView> {
    this.assertOwner(input.agent_id, input.owner_user_id)
    const promoted = await this.deps.mediaReuseGovernanceService.promotePrivateOriginalToSelfPublicArchive({
      asset_id: input.asset_id,
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      actor_user_id: input.owner_user_id,
    })
    const media_url = await this.deps.mediaAssetService.getResolvedMediaUrl(promoted.asset.id)
    if (!media_url) {
      throw new NotFoundError('MediaAsset', promoted.asset.id)
    }
    return this.toView({
      asset: promoted.asset,
      snapshot: promoted.binding.semantic_snapshot_id
        ? await this.deps.mediaAssetService.getCurrentSemanticSnapshot(promoted.asset.id)
        : null,
      owner_note: null,
      media_url,
      latest_post_id: null,
      created_at: promoted.asset.created_at,
    })
  }

  async demoteAsset(input: {
    agent_id: string
    owner_user_id: string
    asset_id: string
  }): Promise<InclinationAssetView> {
    this.assertOwner(input.agent_id, input.owner_user_id)
    const demoted = await this.deps.mediaReuseGovernanceService.demoteSelfPublicArchiveAsset({
      asset_id: input.asset_id,
      agent_id: input.agent_id,
      owner_user_id: input.owner_user_id,
      actor_user_id: input.owner_user_id,
    })
    const media_url = await this.deps.mediaAssetService.getResolvedMediaUrl(demoted.asset.id)
    if (!media_url) {
      throw new NotFoundError('MediaAsset', demoted.asset.id)
    }
    return this.toView({
      asset: demoted.asset,
      snapshot: await this.deps.mediaAssetService.getCurrentSemanticSnapshot(demoted.asset.id),
      owner_note: null,
      media_url,
      latest_post_id: null,
      created_at: demoted.asset.created_at,
    })
  }

  async listPendingAgentIds(limit = 100): Promise<string[]> {
    return this.deps.mediaAssetService.listEligibleOwnerPoolAgentIds(limit)
  }

  async getPendingForAgent(agentId: string): Promise<ScheduledMediaCandidate | null> {
    return this.deps.mediaAssetService.getLatestEligibleOwnerPoolAsset(agentId)
  }

  attachPostMediaAndConsume(input: {
    asset_id: string
    post_id: string
  }): Promise<{ linked: boolean }> {
    return this.deps.mediaAssetService.attachAssetToForumPost(input)
  }

  getAssetMediaFile(assetId: string): Promise<{
    mime_type: string
    data: Buffer
  } | null> {
    return this.deps.mediaAssetService.getAssetMediaFile(assetId)
  }

  getStoredMediaByKey(storageKey: string): Promise<{
    mime_type: string
    data: Buffer
  } | null> {
    return this.deps.mediaAssetService.getStoredMediaByKey(storageKey)
  }

  private toView(record: Awaited<ReturnType<MediaAssetService['ingestOwnerUpload']>>): InclinationAssetView {
    return {
      asset_id: record.asset.id,
      visibility_policy: record.asset.visibility_policy,
      lifecycle_status: record.asset.lifecycle_status,
      media_url: record.media_url,
      mime_type: record.asset.mime_type,
      file_size_bytes: record.asset.file_size_bytes,
      width: record.asset.width,
      height: record.asset.height,
      owner_note: record.owner_note,
      semantic_summary: MediaAssetService.readSummaryOrFallback(record.snapshot, record.asset.mime_type),
      created_at: record.created_at.toISOString(),
      latest_post_id: record.latest_post_id,
    }
  }

  private assertOwner(agentId: string, ownerUserId: string): void {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    if (agent.owner_id !== ownerUserId) {
      throw new ForbiddenError('Not your agent')
    }
  }

  private normalizeOwnerNote(ownerNote: string | undefined): string | null {
    if (!ownerNote) return null
    const value = ownerNote.trim()
    if (!value) return null
    if (value.length > 500) {
      throw new ValidationError('owner_note exceeds 500 chars')
    }
    return value
  }
}
