import { Prisma, type PrismaClient } from '@prisma/client'

export type SeedMediaCleanupBindingRow = {
  id: string
  assetId: string
  semanticSnapshotId: string
}

export type SeedMediaCleanupTargets = {
  bindingIds: string[]
  assetIds: string[]
  semanticSnapshotIds: string[]
  catalogCardIds: string[]
  retrievalDocumentIds: string[]
}

type SeedMediaCleanupReadClient = Pick<
  PrismaClient,
  'mediaSemanticSnapshot' | 'mediaCatalogCardRecord' | 'mediaRetrievalDocumentRecord'
>

type SeedMediaCleanupWriteClient = Pick<
  Prisma.TransactionClient,
  | 'mediaContextProjection'
  | 'sceneMediaBinding'
  | 'mediaEmbeddingSnapshotRecord'
  | 'mediaRetrievalDocumentRecord'
  | 'mediaCatalogCardRecord'
  | 'mediaReusePolicyRecord'
  | 'mediaLineageEdge'
  | 'mediaSemanticSnapshot'
  | 'mediaAsset'
>

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

export async function expandSeedMediaCleanupTargets(
  prisma: SeedMediaCleanupReadClient,
  input: {
    directAssetIds: readonly string[]
    bindingRows: readonly SeedMediaCleanupBindingRow[]
  },
): Promise<SeedMediaCleanupTargets> {
  const bindingIds = input.bindingRows.map((row) => row.id)
  const assetIds = unique([
    ...input.directAssetIds,
    ...input.bindingRows.map((row) => row.assetId),
  ])

  if (assetIds.length === 0) {
    return {
      bindingIds,
      assetIds,
      semanticSnapshotIds: unique(input.bindingRows.map((row) => row.semanticSnapshotId)),
      catalogCardIds: [],
      retrievalDocumentIds: [],
    }
  }

  const snapshotRows = await prisma.mediaSemanticSnapshot.findMany({
    where: {
      assetId: {
        in: assetIds,
      },
    },
    select: {
      id: true,
    },
  })
  const semanticSnapshotIds = unique([
    ...input.bindingRows.map((row) => row.semanticSnapshotId),
    ...snapshotRows.map((row) => row.id),
  ])

  const catalogCardRows =
    assetIds.length > 0 || semanticSnapshotIds.length > 0
      ? await prisma.mediaCatalogCardRecord.findMany({
          where: {
            OR: [
              assetIds.length > 0
                ? {
                    assetId: {
                      in: assetIds,
                    },
                  }
                : undefined,
              semanticSnapshotIds.length > 0
                ? {
                    semanticSnapshotId: {
                      in: semanticSnapshotIds,
                    },
                  }
                : undefined,
            ].filter(Boolean) as Prisma.MediaCatalogCardRecordWhereInput[],
          },
          select: {
            id: true,
          },
        })
      : []
  const catalogCardIds = unique(catalogCardRows.map((row) => row.id))

  const retrievalDocumentRows =
    assetIds.length > 0 || catalogCardIds.length > 0
      ? await prisma.mediaRetrievalDocumentRecord.findMany({
          where: {
            OR: [
              assetIds.length > 0
                ? {
                    assetId: {
                      in: assetIds,
                    },
                  }
                : undefined,
              catalogCardIds.length > 0
                ? {
                    catalogCardId: {
                      in: catalogCardIds,
                    },
                  }
                : undefined,
            ].filter(Boolean) as Prisma.MediaRetrievalDocumentRecordWhereInput[],
          },
          select: {
            id: true,
          },
        })
      : []

  return {
    bindingIds,
    assetIds,
    semanticSnapshotIds,
    catalogCardIds,
    retrievalDocumentIds: unique(retrievalDocumentRows.map((row) => row.id)),
  }
}

export async function deleteSeedMediaCleanupTargets(
  tx: SeedMediaCleanupWriteClient,
  targets: SeedMediaCleanupTargets,
): Promise<void> {
  if (targets.retrievalDocumentIds.length > 0) {
    await tx.mediaEmbeddingSnapshotRecord.deleteMany({
      where: {
        retrievalDocumentId: {
          in: targets.retrievalDocumentIds,
        },
      },
    })
  }

  if (targets.bindingIds.length > 0) {
    await tx.mediaContextProjection.deleteMany({
      where: {
        bindingId: {
          in: targets.bindingIds,
        },
      },
    })
  }

  if (targets.bindingIds.length > 0 || targets.assetIds.length > 0) {
    await tx.sceneMediaBinding.deleteMany({
      where: {
        OR: [
          targets.bindingIds.length > 0
            ? {
                id: {
                  in: targets.bindingIds,
                },
              }
            : undefined,
          targets.assetIds.length > 0
            ? {
                assetId: {
                  in: targets.assetIds,
                },
              }
            : undefined,
        ].filter(Boolean) as Prisma.SceneMediaBindingWhereInput[],
      },
    })
  }

  if (targets.retrievalDocumentIds.length > 0) {
    await tx.mediaRetrievalDocumentRecord.deleteMany({
      where: {
        id: {
          in: targets.retrievalDocumentIds,
        },
      },
    })
  }

  if (targets.catalogCardIds.length > 0) {
    await tx.mediaCatalogCardRecord.deleteMany({
      where: {
        id: {
          in: targets.catalogCardIds,
        },
      },
    })
  }

  if (targets.assetIds.length > 0) {
    await tx.mediaReusePolicyRecord.deleteMany({
      where: {
        subjectType: 'asset',
        subjectId: {
          in: targets.assetIds,
        },
      },
    })
  }

  if (targets.assetIds.length > 0 || targets.semanticSnapshotIds.length > 0) {
    await tx.mediaLineageEdge.deleteMany({
      where: {
        OR: [
          targets.assetIds.length > 0
            ? {
                fromNodeType: 'asset',
                fromNodeId: {
                  in: targets.assetIds,
                },
              }
            : undefined,
          targets.semanticSnapshotIds.length > 0
            ? {
                toNodeType: 'semantic_snapshot',
                toNodeId: {
                  in: targets.semanticSnapshotIds,
                },
              }
            : undefined,
        ].filter(Boolean) as Prisma.MediaLineageEdgeWhereInput[],
      },
    })
  }

  if (targets.semanticSnapshotIds.length > 0) {
    await tx.mediaSemanticSnapshot.deleteMany({
      where: {
        id: {
          in: targets.semanticSnapshotIds,
        },
      },
    })
  }

  if (targets.assetIds.length > 0) {
    await tx.mediaAsset.deleteMany({
      where: {
        id: {
          in: targets.assetIds,
        },
      },
    })
  }
}
