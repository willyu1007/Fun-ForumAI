import { describe, expect, it, vi } from 'vitest'
import {
  deleteSeedMediaCleanupTargets,
  expandSeedMediaCleanupTargets,
} from '../dev-seed-media-cleanup.js'

describe('expandSeedMediaCleanupTargets', () => {
  it('includes every semantic snapshot attached to a targeted asset, not only bound snapshots', async () => {
    const mediaSemanticSnapshotFindMany = vi.fn(async () => [
      { id: 'snapshot-current' },
      { id: 'snapshot-legacy' },
    ])
    const mediaCatalogCardFindMany = vi.fn(async () => [])
    const mediaRetrievalDocumentFindMany = vi.fn(async () => [])

    const result = await expandSeedMediaCleanupTargets({
      mediaSemanticSnapshot: {
        findMany: mediaSemanticSnapshotFindMany,
      },
      mediaCatalogCardRecord: {
        findMany: mediaCatalogCardFindMany,
      },
      mediaRetrievalDocumentRecord: {
        findMany: mediaRetrievalDocumentFindMany,
      },
    } as never, {
      directAssetIds: ['asset-1'],
      bindingRows: [
        {
          id: 'binding-1',
          assetId: 'asset-1',
          semanticSnapshotId: 'snapshot-current',
        },
      ],
    })

    expect(mediaSemanticSnapshotFindMany).toHaveBeenCalledWith({
      where: {
        assetId: {
          in: ['asset-1'],
        },
      },
      select: {
        id: true,
      },
    })
    expect(result.semanticSnapshotIds.sort()).toEqual(['snapshot-current', 'snapshot-legacy'].sort())
  })
})

describe('deleteSeedMediaCleanupTargets', () => {
  it('deletes snapshot-linked dependents before deleting snapshots and assets', async () => {
    const calls: string[] = []
    const record = (label: string) =>
      vi.fn(async () => {
        calls.push(label)
      })

    await deleteSeedMediaCleanupTargets({
      mediaEmbeddingSnapshotRecord: { deleteMany: record('embeddings') },
      mediaContextProjection: { deleteMany: record('projections') },
      sceneMediaBinding: { deleteMany: record('bindings') },
      mediaRetrievalDocumentRecord: { deleteMany: record('docs') },
      mediaCatalogCardRecord: { deleteMany: record('cards') },
      mediaReusePolicyRecord: { deleteMany: record('reuse') },
      mediaLineageEdge: { deleteMany: record('lineage') },
      mediaSemanticSnapshot: { deleteMany: record('snapshots') },
      mediaAsset: { deleteMany: record('assets') },
    } as never, {
      bindingIds: ['binding-1'],
      assetIds: ['asset-1'],
      semanticSnapshotIds: ['snapshot-current', 'snapshot-legacy'],
      catalogCardIds: ['card-1'],
      retrievalDocumentIds: ['doc-1'],
    })

    expect(calls).toEqual([
      'embeddings',
      'projections',
      'bindings',
      'docs',
      'cards',
      'reuse',
      'lineage',
      'snapshots',
      'assets',
    ])
  })
})
