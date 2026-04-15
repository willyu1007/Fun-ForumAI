import { config } from '../lib/config.js'
import type {
  MediaAsset,
  MediaCatalogCard,
  MediaContextProjection,
  MediaEmbeddingSnapshot,
  MediaRetrievalDocScope,
  MediaRetrievalDocument,
  MediaSemanticSnapshot,
  PersistedVisualDirective,
  SceneMediaBinding,
  VisualSourceKind,
} from '../repos/types.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type {
  MediaRetrievalSearchHit,
  MediaRetrievalSearchRepository,
} from '../repos/media-retrieval-search-repository.js'
import type { MediaRetrievalDocumentRepository } from '../repos/media-retrieval-document-repository.js'
import { buildOwnerPrivatePoolSceneId } from './media-binding-service.js'
import {
  buildCommunityCommonsPoolSceneId,
  buildGeneratedPublicPoolSceneId,
  buildPlatformCanonicalPoolSceneId,
  buildPrivateDerivedPublicPoolSceneId,
  buildSelfPublicArchivePoolSceneId,
} from './media-reuse-governance-service.js'
import type { MediaCatalogService } from './media-catalog-service.js'
import type { MediaEmbeddingService } from './media-embedding-service.js'
import type { MediaDuplicateService } from './media-duplicate-service.js'
import {
  buildMediaRetrievalDocKey,
  computeMediaContentHash,
  dedupeStrings,
  summarizeSnapshotTerms,
} from './media-retrieval-utils.js'

export interface MediaRetrievalServiceDeps {
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: Pick<MediaSemanticSnapshotRepository, 'findCurrentByAssetId'>
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaRetrievalDocumentRepo: MediaRetrievalDocumentRepository
  mediaRetrievalSearchRepo: MediaRetrievalSearchRepository
  mediaCatalogService: MediaCatalogService
  mediaEmbeddingService: MediaEmbeddingService
  mediaDuplicateService?: MediaDuplicateService | null
}

export interface EnsureMediaRetrievalInput {
  asset: MediaAsset
  snapshot?: MediaSemanticSnapshot | null
  source_kind: VisualSourceKind
  target_scope: {
    owner_user_id: string | null
    steward_agent_id: string | null
    community_id: string | null
  }
  annotations?: {
    tags?: string[]
    internal_note?: string | null
    owner_note?: string | null
  }
  requested_scopes?: MediaRetrievalDocScope[]
  generated_from?: 'catalog_card' | 'generated_text_derived' | 'projection_handoff'
  reason?: string | null
  duplicate_cluster_id?: string | null
  is_canonical?: boolean
}

export interface RetrievalPlannerCandidate {
  source_kind: VisualSourceKind
  asset: MediaAsset
  snapshot: MediaSemanticSnapshot
  binding: SceneMediaBinding | null
  projection: MediaContextProjection | null
  summary: {
    theme: string
    scene: string
    mood: string
    public_safe_caption: string
    alt_text: string
    salient_entities: string[]
    discussion_points: string[]
  }
  why_relevant_hint?: string
}

export interface EnsuredMediaRetrievalRecord {
  document: MediaRetrievalDocument
  embedding_snapshot: MediaEmbeddingSnapshot | null
}

export class MediaRetrievalService {
  constructor(private readonly deps: MediaRetrievalServiceDeps) {}

  async ensureAssetIndexed(input: EnsureMediaRetrievalInput): Promise<EnsuredMediaRetrievalRecord[]> {
    const snapshot = input.snapshot ?? await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(input.asset.id)
    if (!snapshot) return []
    const card = await this.deps.mediaCatalogService.ensureCurrentCard({
      asset: input.asset,
      snapshot,
      source_kind: input.source_kind,
      target_scope: {
        community_id: input.target_scope.community_id,
      },
      annotations: input.annotations,
    })
    if (!card) return []

    const docScopes = resolveDocScopes(input)
    const ensured: EnsuredMediaRetrievalRecord[] = []
    for (const docScope of docScopes) {
      const built = buildDocumentFromCard({
        asset: input.asset,
        snapshot,
        card,
        doc_scope: docScope,
        target_scope: input.target_scope,
        generated_from: input.generated_from ?? 'catalog_card',
        reason: input.reason ?? null,
        duplicate_cluster_id: input.duplicate_cluster_id ?? input.asset.duplicate_cluster_id ?? null,
        is_canonical: input.is_canonical ?? (!input.duplicate_cluster_id || input.asset.duplicate_distance === 0),
      })
      const current = await this.deps.mediaRetrievalDocumentRepo.findByAssetIdAndScope(input.asset.id, docScope)
      const document = current
        ? await this.deps.mediaRetrievalDocumentRepo.update(current.id, {
            catalog_card_id: built.catalog_card_id,
            duplicate_cluster_id: built.duplicate_cluster_id,
            is_canonical: built.is_canonical,
            lifecycle_status: built.lifecycle_status,
            document_text: built.document_text,
            document_hash: built.document_hash,
            document_meta_json: built.document_meta_json,
          }).then((item) => item ?? current)
        : await this.deps.mediaRetrievalDocumentRepo.create(built)
      const embeddingSnapshot = await this.deps.mediaEmbeddingService.ensureDocumentEmbedding({
        document,
        trace_id: `media-retrieval:${document.id}`,
      })
      ensured.push({
        document,
        embedding_snapshot: embeddingSnapshot,
      })
    }
    return ensured
  }

  async searchPlannerCandidates(input: {
    agent_id: string
    directive: PersistedVisualDirective
    limit?: number
  }): Promise<RetrievalPlannerCandidate[]> {
    if (
      !config.launch.capabilities.mediaRetrievalV1
      || !config.launch.capabilities.mediaPlannerRetrievalV1
    ) {
      return []
    }

    const queryVector = await this.deps.mediaEmbeddingService.embedQuery({
      query_text: buildDirectiveSearchText(input.directive),
      trace_id: `planner-search:${input.directive.id}`,
    })
    if (!queryVector) return []

    const hits = await Promise.all(
      input.directive.sourcing_policy.allow_sources.map((sourceKind) =>
        this.searchBySource({
          agent_id: input.agent_id,
          directive: input.directive,
          source_kind: sourceKind,
          query_vector: queryVector,
          limit: Math.max(4, Math.ceil((input.limit ?? config.mediaRetrieval.retrievalLimit) / 2)),
        }),
      ),
    ).then((groups) => groups.flat())

    const dedupedHits = this.deps.mediaDuplicateService
      ? this.deps.mediaDuplicateService.suppressSearchHits(hits)
      : hits
    if (dedupedHits.length === 0) return []

    const documents = await this.deps.mediaRetrievalDocumentRepo.findByIds(
      dedupedHits.map((item) => item.retrieval_document_id),
    )
    const documentById = new Map(documents.map((item) => [item.id, item]))
    const assets = await this.deps.mediaAssetRepo.findByIds(documents.map((item) => item.asset_id))
    const assetById = new Map(assets.map((item) => [item.id, item]))
    const candidates: RetrievalPlannerCandidate[] = []

    for (const hit of dedupedHits) {
      const document = documentById.get(hit.retrieval_document_id)
      if (!document) continue
      const asset = assetById.get(document.asset_id)
      if (!asset) continue
      const snapshot = await this.deps.mediaSemanticSnapshotRepo.findCurrentByAssetId(asset.id)
      if (!snapshot) continue
      const binding = await this.resolveBindingForSource(asset, document.source_kind, document.community_id)
      candidates.push({
        source_kind: document.source_kind,
        asset,
        snapshot,
        binding,
        projection: null,
        why_relevant_hint: `semantic retrieval score=${hit.score.toFixed(3)}`,
        summary: {
          theme: snapshot.summary.theme,
          scene: snapshot.summary.scene,
          mood: snapshot.summary.mood,
          public_safe_caption: snapshot.summary.public_safe_summary,
          alt_text: snapshot.summary.public_safe_summary,
          salient_entities: snapshot.summary.salient_entities.slice(0, 5),
          discussion_points: snapshot.summary.discussion_points.slice(0, 5),
        },
      })
    }

    return candidates
  }

  private async searchBySource(input: {
    agent_id: string
    directive: PersistedVisualDirective
    source_kind: VisualSourceKind
    query_vector: number[]
    limit: number
  }): Promise<MediaRetrievalSearchHit[]> {
    if (input.directive.guardrails.safe_mode && input.source_kind === 'owner_private_pool') {
      return []
    }
    const searchSpec = buildSearchSpec(input.source_kind, input.agent_id, input.directive)
    if (!searchSpec) return []
    return this.deps.mediaRetrievalSearchRepo.searchActive({
      query_vector: input.query_vector,
      index_profile_id: config.mediaRetrieval.indexProfileId,
      limit: input.limit,
      doc_scopes: searchSpec.doc_scopes,
      source_kinds: [input.source_kind],
      owner_user_id: searchSpec.owner_user_id,
      steward_agent_id: searchSpec.steward_agent_id,
      community_id: searchSpec.community_id,
      only_canonical: true,
    })
  }

  private async resolveBindingForSource(
    asset: MediaAsset,
    sourceKind: VisualSourceKind,
    communityId: string | null,
  ): Promise<SceneMediaBinding | null> {
    const bindings = await this.deps.sceneMediaBindingRepo.findByAssetId(asset.id)
    switch (sourceKind) {
      case 'owner_private_pool':
        return bindings.find((binding) =>
          binding.scene_type === 'memory_card'
          && binding.scene_id === buildOwnerPrivatePoolSceneId(asset.steward_agent_id ?? '')) ?? null
      case 'community_commons':
        return communityId
          ? bindings.find((binding) =>
              binding.scene_type === 'media_pool'
              && binding.scene_id === buildCommunityCommonsPoolSceneId(communityId)) ?? null
          : null
      case 'platform_canonical':
        return bindings.find((binding) =>
          binding.scene_type === 'media_pool'
          && binding.scene_id === buildPlatformCanonicalPoolSceneId()) ?? null
      case 'generated_public':
        return bindings.find((binding) =>
          binding.scene_type === 'media_pool'
          && binding.scene_id === buildGeneratedPublicPoolSceneId(asset.steward_agent_id ?? '')) ?? null
      case 'private_derived_public':
        return bindings.find((binding) =>
          binding.scene_type === 'media_pool'
          && binding.scene_id === buildPrivateDerivedPublicPoolSceneId(asset.steward_agent_id ?? '')) ?? null
      case 'self_public_archive':
        return bindings.find((binding) =>
          binding.scene_type === 'media_pool'
          && binding.scene_id === buildSelfPublicArchivePoolSceneId(asset.steward_agent_id ?? '')) ?? null
      default:
        return bindings[0] ?? null
    }
  }
}

function buildDocumentFromCard(input: {
  asset: MediaAsset
  snapshot: MediaSemanticSnapshot
  card: MediaCatalogCard
  doc_scope: MediaRetrievalDocScope
  target_scope: EnsureMediaRetrievalInput['target_scope']
  generated_from: NonNullable<EnsureMediaRetrievalInput['generated_from']>
  reason: string | null
  duplicate_cluster_id: string | null
  is_canonical: boolean
}) {
  const retrievalTerms = dedupeStrings([
    ...input.card.payload_json.tags,
    ...summarizeSnapshotTerms(input.snapshot),
    input.target_scope.community_id,
  ])
  const lines = [
    `theme: ${input.card.payload_json.theme}`,
    `scene: ${input.card.payload_json.scene}`,
    `mood: ${input.card.payload_json.mood}`,
    `safe_summary: ${input.card.payload_json.public_safe_summary}`,
    input.card.payload_json.tags.length > 0 ? `tags: ${input.card.payload_json.tags.join(', ')}` : null,
    input.card.payload_json.salient_entities.length > 0
      ? `entities: ${input.card.payload_json.salient_entities.join(', ')}`
      : null,
    input.card.payload_json.discussion_points.length > 0
      ? `discussion_points: ${input.card.payload_json.discussion_points.join(', ')}`
      : null,
    input.reason ? `reason: ${input.reason}` : null,
    input.doc_scope === 'private_internal' && input.card.payload_json.annotations.owner_note
      ? `owner_note: ${input.card.payload_json.annotations.owner_note}`
      : null,
    input.doc_scope === 'private_internal' && input.card.payload_json.annotations.internal_note
      ? `internal_note: ${input.card.payload_json.annotations.internal_note}`
      : null,
  ].filter((line): line is string => Boolean(line))
  const documentText = lines.join('\n')

  return {
    doc_key: buildMediaRetrievalDocKey(input.asset.id, input.doc_scope),
    asset_id: input.asset.id,
    catalog_card_id: input.card.id,
    duplicate_cluster_id: input.duplicate_cluster_id,
    doc_scope: input.doc_scope,
    modality: 'image' as const,
    source_kind: input.card.payload_json.source_kind,
    owner_user_id: input.target_scope.owner_user_id,
    steward_agent_id: input.target_scope.steward_agent_id,
    community_id: input.target_scope.community_id,
    is_canonical: input.is_canonical,
    lifecycle_status: input.asset.lifecycle_status === 'blocked' ? 'blocked' as const : 'active' as const,
    document_text: documentText,
    document_hash: computeMediaContentHash(documentText),
    document_meta_json: {
      source_kind: input.card.payload_json.source_kind,
      scope_hints: {
        owner_user_id: input.target_scope.owner_user_id,
        steward_agent_id: input.target_scope.steward_agent_id,
        community_id: input.target_scope.community_id,
      },
      retrieval_terms: retrievalTerms,
      reason: input.reason,
      public_safe_enabled: input.doc_scope !== 'private_internal',
      generated_from: input.generated_from,
    },
  }
}

function resolveDocScopes(input: EnsureMediaRetrievalInput): MediaRetrievalDocScope[] {
  if (input.requested_scopes?.length) {
    return Array.from(new Set(input.requested_scopes))
  }
  const scopes: MediaRetrievalDocScope[] = [input.target_scope.community_id ? 'community_scoped' : input.source_kind === 'owner_private_pool' ? 'private_internal' : 'public_safe']
  if (input.source_kind === 'community_commons') scopes.push('public_safe')
  if (input.source_kind === 'owner_private_pool' && input.annotations?.owner_note) scopes.push('private_internal')
  return Array.from(new Set(scopes))
}

function buildDirectiveSearchText(directive: PersistedVisualDirective): string {
  return [
    directive.narrative_context.semantic_query,
    directive.narrative_context.objective,
    directive.narrative_context.hook,
    `tone: ${directive.narrative_context.tone_hint}`,
    `human_goal: ${directive.goal.human_goal}`,
    `visual_role: ${directive.goal.visual_role}`,
    directive.narrative_context.required_elements?.length
      ? `required: ${directive.narrative_context.required_elements.join(', ')}`
      : null,
    directive.narrative_context.forbidden_elements?.length
      ? `forbidden: ${directive.narrative_context.forbidden_elements.join(', ')}`
      : null,
  ].filter((line): line is string => Boolean(line)).join('\n')
}

function buildSearchSpec(
  sourceKind: VisualSourceKind,
  agentId: string,
  directive: PersistedVisualDirective,
): {
  doc_scopes: MediaRetrievalDocScope[]
  owner_user_id?: string
  steward_agent_id?: string
  community_id?: string
} | null {
  switch (sourceKind) {
    case 'owner_private_pool':
      return {
        doc_scopes: ['private_internal'],
        steward_agent_id: agentId,
      }
    case 'community_commons':
      return directive.scene_ref.community_id
        ? {
            doc_scopes: ['community_scoped', 'public_safe'],
            community_id: directive.scene_ref.community_id,
          }
        : null
    case 'platform_canonical':
      return { doc_scopes: ['public_safe'] }
    case 'generated_public':
    case 'private_derived_public':
    case 'self_public_archive':
      return {
        doc_scopes: ['public_safe'],
        steward_agent_id: agentId,
      }
    default:
      return null
  }
}
