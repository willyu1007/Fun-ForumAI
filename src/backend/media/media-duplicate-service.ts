import type { MediaAsset, MediaDuplicateCluster, VisualSourceKind } from '../repos/types.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaDuplicateClusterRepository } from '../repos/media-duplicate-cluster-repository.js'
import type { MediaRetrievalSearchHit } from '../repos/media-retrieval-search-repository.js'

export interface MediaDuplicateServiceDeps {
  mediaAssetRepo: MediaAssetRepository
  mediaDuplicateClusterRepo: MediaDuplicateClusterRepository
}

export interface FindReusableExactAssetInput {
  sha256: string
  source_kind: VisualSourceKind
  target_scope: {
    owner_user_id: string | null
    steward_agent_id: string | null
  }
}

export class MediaDuplicateService {
  constructor(private readonly deps: MediaDuplicateServiceDeps) {}

  async findReusableExactAsset(input: FindReusableExactAssetInput): Promise<MediaAsset | null> {
    const matches = await this.deps.mediaAssetRepo.listBySha256(input.sha256)
    return matches.find((asset) => canReuseExactAsset(asset, input)) ?? null
  }

  async reconcileAssetClusters(asset: MediaAsset): Promise<MediaDuplicateCluster | null> {
    const exactMatches = (await this.deps.mediaAssetRepo.listBySha256(asset.sha256))
      .filter((item) => item.id !== asset.id)
    const nearMatches = asset.phash
      ? (await this.deps.mediaAssetRepo.listByPhash(asset.phash)).filter((item) => item.id !== asset.id)
      : []
    const members = uniqueAssets([asset, ...exactMatches, ...nearMatches])
    if (members.length <= 1) {
      if (asset.duplicate_cluster_id) {
        return this.deps.mediaDuplicateClusterRepo.findById(asset.duplicate_cluster_id)
      }
      return null
    }

    const duplicateKind = exactMatches.length > 0 ? 'exact' : 'near'
    const canonical = pickCanonicalAsset(members)
    const existingClusterId = members.find((item) => item.duplicate_cluster_id)?.duplicate_cluster_id ?? null
    const cluster = existingClusterId
      ? await this.deps.mediaDuplicateClusterRepo.update(existingClusterId, {
          canonical_asset_id: canonical.id,
          evidence_json: {
            duplicate_kind: duplicateKind,
            member_asset_ids: members.map((item) => item.id),
          },
          status: 'active',
        })
      : await this.deps.mediaDuplicateClusterRepo.create({
          duplicate_kind: duplicateKind,
          canonical_asset_id: canonical.id,
          evidence_json: {
            duplicate_kind: duplicateKind,
            member_asset_ids: members.map((item) => item.id),
          },
          status: 'active',
        })
    if (!cluster) return null

    await Promise.all(members.map((item) =>
      this.deps.mediaAssetRepo.update(item.id, {
        duplicate_cluster_id: cluster.id,
        duplicate_distance: duplicateKind === 'exact'
          ? 0
          : item.id === canonical.id
            ? 0
            : 1,
      }),
    ))
    return cluster
  }

  suppressSearchHits(hits: MediaRetrievalSearchHit[]): MediaRetrievalSearchHit[] {
    const seenClusterOrAsset = new Set<string>()
    const result: MediaRetrievalSearchHit[] = []
    for (const hit of hits) {
      const key = hit.duplicate_cluster_id
        ? `cluster:${hit.duplicate_cluster_id}`
        : `asset:${hit.asset_id}`
      if (seenClusterOrAsset.has(key)) continue
      seenClusterOrAsset.add(key)
      result.push(hit)
    }
    return result
  }
}

function canReuseExactAsset(asset: MediaAsset, input: FindReusableExactAssetInput): boolean {
  if (asset.lifecycle_status !== 'active') return false
  if (input.source_kind === 'owner_private_pool') {
    return asset.steward_agent_id === input.target_scope.steward_agent_id
      && asset.owner_user_id === input.target_scope.owner_user_id
  }
  return asset.visibility_policy !== 'private_only'
}

function uniqueAssets(items: MediaAsset[]): MediaAsset[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

function pickCanonicalAsset(items: MediaAsset[]): MediaAsset {
  return [...items].sort((left, right) =>
    left.created_at.getTime() - right.created_at.getTime()
    || left.id.localeCompare(right.id))[0]!
}
