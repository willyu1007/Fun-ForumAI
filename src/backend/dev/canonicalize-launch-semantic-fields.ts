import { disconnectPrisma, getPrismaClient } from '../persistence/prisma-client.js'
import {
  canonicalizeLaunchCardMode,
  canonicalizeLaunchCreatorNoteCoverMode,
  canonicalizeLaunchCreatorNoteTemplateId,
} from './launch-semantic-canonicalization.js'

type ScopeName =
  | 'all'
  | 'search-docs'
  | 'viewer-events'
  | 'post-search-docs'
  | 'thread-search-docs'

type UpdatePatch = {
  noteTemplateId?: string | null
  coverMode?: string | null
  cardMode?: string | null
}

type PendingUpdate = {
  id: string
  patch: UpdatePatch
}

type TableSummary = {
  table_available: boolean
  table_error: string | null
  scanned_rows: number
  rows_with_changes: number
  updated_rows: number
  changed_fields: Record<string, number>
  unknown_values: Array<{
    row_id: string
    field: keyof UpdatePatch
    value: string
  }>
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function emptySummary(): TableSummary {
  return {
    table_available: true,
    table_error: null,
    scanned_rows: 0,
    rows_with_changes: 0,
    updated_rows: 0,
    changed_fields: {
      noteTemplateId: 0,
      coverMode: 0,
      cardMode: 0,
    },
    unknown_values: [],
  }
}

function isMissingTableError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2021'
}

function applyCanonicalization(
  rowId: string,
  input: { noteTemplateId?: unknown; coverMode?: unknown; cardMode?: unknown },
  summary: TableSummary,
): PendingUpdate | null {
  summary.scanned_rows += 1

  const patch: UpdatePatch = {}
  let rowHasChanges = false

  const noteTemplate = canonicalizeLaunchCreatorNoteTemplateId(input.noteTemplateId)
  if (noteTemplate.status === 'unknown') {
    summary.unknown_values.push({
      row_id: rowId,
      field: 'noteTemplateId',
      value: noteTemplate.original,
    })
  } else if (noteTemplate.changed) {
    patch.noteTemplateId = noteTemplate.value
    summary.changed_fields.noteTemplateId += 1
    rowHasChanges = true
  }

  const coverMode = canonicalizeLaunchCreatorNoteCoverMode(input.coverMode)
  if (coverMode.status === 'unknown') {
    summary.unknown_values.push({
      row_id: rowId,
      field: 'coverMode',
      value: coverMode.original,
    })
  } else if (coverMode.changed) {
    patch.coverMode = coverMode.value
    summary.changed_fields.coverMode += 1
    rowHasChanges = true
  }

  if (input.cardMode !== undefined) {
    const cardMode = canonicalizeLaunchCardMode(input.cardMode)
    if (cardMode.status === 'unknown') {
      summary.unknown_values.push({
        row_id: rowId,
        field: 'cardMode',
        value: cardMode.original,
      })
    } else if (cardMode.changed) {
      patch.cardMode = cardMode.value
      summary.changed_fields.cardMode += 1
      rowHasChanges = true
    }
  }

  if (!rowHasChanges) return null
  summary.rows_with_changes += 1
  return { id: rowId, patch }
}

async function main() {
  const prisma = getPrismaClient()
  const apply = hasFlag('apply')
  const scope = (readArg('scope') ?? 'all') as ScopeName
  const batchSize = parsePositiveInt(readArg('batch-size'), 200)

  const includeSearchDocs = scope === 'all' || scope === 'search-docs' || scope === 'post-search-docs' || scope === 'thread-search-docs'
  const includePostSearchDocs = scope === 'all' || scope === 'search-docs' || scope === 'post-search-docs'
  const includeThreadSearchDocs = scope === 'all' || scope === 'search-docs' || scope === 'thread-search-docs'
  const includeViewerEvents = scope === 'all' || scope === 'viewer-events'

  if (!['all', 'search-docs', 'viewer-events', 'post-search-docs', 'thread-search-docs'].includes(scope)) {
    throw new Error('scope must be one of: all, search-docs, viewer-events, post-search-docs, thread-search-docs')
  }

  const postSearchSummary = emptySummary()
  const threadSearchSummary = emptySummary()
  const viewerEventSummary = emptySummary()
  const postSearchUpdates: PendingUpdate[] = []
  const threadSearchUpdates: PendingUpdate[] = []
  const viewerEventUpdates: PendingUpdate[] = []

  const missingTables: string[] = []

  async function tableExists(tableName: string): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS "exists"
      `,
      tableName,
    )
    return rows[0]?.exists === true
  }

  async function loadRows<T>(
    tableName: string,
    summary: TableSummary,
    loader: () => Promise<T[]>,
  ): Promise<T[] | null> {
    const exists = await tableExists(tableName)
    if (!exists) {
      summary.table_available = false
      summary.table_error = 'table is missing in the current database'
      missingTables.push(tableName)
      return null
    }

    try {
      return await loader()
    } catch (error) {
      if (isMissingTableError(error)) {
        summary.table_available = false
        summary.table_error = 'table is missing in the current database'
        missingTables.push(tableName)
        return null
      }
      throw error
    }
  }

  if (includeSearchDocs && includePostSearchDocs) {
    const rows = await loadRows(
      'post_search_docs',
      postSearchSummary,
      () => prisma.postSearchDoc.findMany({
        select: {
          postId: true,
          noteTemplateId: true,
          coverMode: true,
          cardMode: true,
        },
      }),
    )
    if (rows) {
      for (const row of rows) {
        const update = applyCanonicalization(
          row.postId,
          row,
          postSearchSummary,
        )
        if (update) {
          postSearchUpdates.push(update)
        }
      }
    }
  }

  if (includeSearchDocs && includeThreadSearchDocs) {
    const rows = await loadRows(
      'thread_search_docs',
      threadSearchSummary,
      () => prisma.threadSearchDoc.findMany({
        select: {
          threadId: true,
          noteTemplateId: true,
          coverMode: true,
          cardMode: true,
        },
      }),
    )
    if (rows) {
      for (const row of rows) {
        const update = applyCanonicalization(
          row.threadId,
          row,
          threadSearchSummary,
        )
        if (update) {
          threadSearchUpdates.push(update)
        }
      }
    }
  }

  if (includeViewerEvents) {
    const rows = await loadRows(
      'viewer_public_view_events',
      viewerEventSummary,
      () => prisma.viewerPublicViewEvent.findMany({
        select: {
          id: true,
          noteTemplateId: true,
          coverMode: true,
        },
      }),
    )
    if (rows) {
      for (const row of rows) {
        const update = applyCanonicalization(
          row.id,
          row,
          viewerEventSummary,
        )
        if (update) {
          viewerEventUpdates.push(update)
        }
      }
    }
  }

  const unknownValues = [
    ...postSearchSummary.unknown_values.map((entry) => ({ table: 'post_search_docs', ...entry })),
    ...threadSearchSummary.unknown_values.map((entry) => ({ table: 'thread_search_docs', ...entry })),
    ...viewerEventSummary.unknown_values.map((entry) => ({ table: 'viewer_public_view_events', ...entry })),
  ]

  if (apply && unknownValues.length > 0) {
    throw new Error(
      `Refusing to write because unknown launch semantic values remain: ${unknownValues
        .slice(0, 10)
        .map((entry) => `${entry.table}:${entry.row_id}:${entry.field}=${entry.value}`)
        .join(', ')}`,
    )
  }

  if (apply) {
    for (let index = 0; index < postSearchUpdates.length; index += batchSize) {
      await Promise.all(postSearchUpdates.slice(index, index + batchSize).map((entry) =>
        prisma.postSearchDoc.update({
          where: { postId: entry.id },
          data: entry.patch,
        })))
      postSearchSummary.updated_rows += Math.min(batchSize, postSearchUpdates.length - index)
    }

    for (let index = 0; index < threadSearchUpdates.length; index += batchSize) {
      await Promise.all(threadSearchUpdates.slice(index, index + batchSize).map((entry) =>
        prisma.threadSearchDoc.update({
          where: { threadId: entry.id },
          data: entry.patch,
        })))
      threadSearchSummary.updated_rows += Math.min(batchSize, threadSearchUpdates.length - index)
    }

    for (let index = 0; index < viewerEventUpdates.length; index += batchSize) {
      await Promise.all(viewerEventUpdates.slice(index, index + batchSize).map((entry) =>
        prisma.viewerPublicViewEvent.update({
          where: { id: entry.id },
          data: entry.patch,
        })))
      viewerEventSummary.updated_rows += Math.min(batchSize, viewerEventUpdates.length - index)
    }
  }

  const summary = {
    apply,
    scope,
    environment_ready: missingTables.length === 0,
    missing_tables: missingTables,
    search_doc_rebuild_required: includeSearchDocs,
    search_reconcile_required: includeSearchDocs,
    post_search_docs: includePostSearchDocs ? postSearchSummary : null,
    thread_search_docs: includeThreadSearchDocs ? threadSearchSummary : null,
    viewer_public_view_events: includeViewerEvents ? viewerEventSummary : null,
    unknown_value_count: unknownValues.length,
    unknown_value_examples: unknownValues.slice(0, 10),
    recommended_follow_up: [
      includeSearchDocs ? 'pnpm search:rebuild-docs' : null,
      includeSearchDocs ? 'pnpm search:reconcile-docs -- --dry-run' : null,
    ].filter((command): command is string => command !== null),
  }

  console.log(JSON.stringify(summary, null, 2))

  if (unknownValues.length > 0) {
    process.exitCode = 1
  }
  if (apply && missingTables.length > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('[launch-semantic-canonicalize] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectPrisma()
  })
