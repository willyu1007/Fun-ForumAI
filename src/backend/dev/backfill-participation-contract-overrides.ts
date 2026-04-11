import { Prisma } from '@prisma/client'
import { disconnectPrisma, getPrismaClient } from '../persistence/prisma-client.js'
import {
  normalizeAgentHumanResponseMode,
  normalizeAudienceSignalIngestion,
  normalizePublicParticipationMode,
} from '../../shared/semantic-taxonomy.js'
import type { ParticipationContractOverride } from '../../shared/forum-orchestration.js'

const LEGACY_METADATA_KEY = 'participation_contract'

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readOptionalRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function compactStageOverride(input: {
  enabled: boolean | null
  new_thread_enabled: boolean | null
  turn_reply_enabled: boolean | null
}): ParticipationContractOverride['stage_open_reply'] | null {
  if (
    input.enabled === null
    && input.new_thread_enabled === null
    && input.turn_reply_enabled === null
  ) {
    return null
  }

  return {
    ...(input.enabled !== null ? { enabled: input.enabled } : {}),
    ...(input.new_thread_enabled !== null ? { new_thread_enabled: input.new_thread_enabled } : {}),
    ...(input.turn_reply_enabled !== null ? { turn_reply_enabled: input.turn_reply_enabled } : {}),
  }
}

function compactAudienceOverride(input: {
  enabled: boolean | null
  posting_enabled: boolean | null
}): ParticipationContractOverride['audience_lane'] | null {
  if (input.enabled === null && input.posting_enabled === null) {
    return null
  }

  return {
    ...(input.enabled !== null ? { enabled: input.enabled } : {}),
    ...(input.posting_enabled !== null ? { posting_enabled: input.posting_enabled } : {}),
  }
}

function normalizeOverride(value: unknown): ParticipationContractOverride | null {
  if (!isRecord(value)) {
    return null
  }

  const publicParticipationMode = normalizePublicParticipationMode(readOptionalString(value.public_participation_mode))
  const audienceSignalIngestion = normalizeAudienceSignalIngestion(readOptionalString(value.audience_signal_ingestion))
  const agentHumanResponseMode = normalizeAgentHumanResponseMode(readOptionalString(value.agent_human_response_mode))

  const stageOpenReplyRecord = readOptionalRecord(value.stage_open_reply)
  const audienceLaneRecord = readOptionalRecord(value.audience_lane)

  const stageOpenReply = compactStageOverride({
    enabled: readOptionalBoolean(stageOpenReplyRecord?.enabled),
    new_thread_enabled: readOptionalBoolean(stageOpenReplyRecord?.new_thread_enabled),
    turn_reply_enabled: readOptionalBoolean(stageOpenReplyRecord?.turn_reply_enabled),
  })

  const audienceLane = compactAudienceOverride({
    enabled: readOptionalBoolean(audienceLaneRecord?.enabled),
    posting_enabled: readOptionalBoolean(audienceLaneRecord?.posting_enabled),
  })

  if (
    !publicParticipationMode
    && !audienceSignalIngestion
    && !agentHumanResponseMode
    && !stageOpenReply
    && !audienceLane
  ) {
    return null
  }

  return {
    ...(publicParticipationMode ? { public_participation_mode: publicParticipationMode } : {}),
    ...(audienceSignalIngestion ? { audience_signal_ingestion: audienceSignalIngestion } : {}),
    ...(agentHumanResponseMode ? { agent_human_response_mode: agentHumanResponseMode } : {}),
    ...(stageOpenReply ? { stage_open_reply: stageOpenReply } : {}),
    ...(audienceLane ? { audience_lane: audienceLane } : {}),
  }
}

function serializeOverride(override: ParticipationContractOverride): Prisma.InputJsonObject {
  return {
    ...(override.public_participation_mode
      ? { public_participation_mode: override.public_participation_mode }
      : {}),
    ...(override.audience_signal_ingestion
      ? { audience_signal_ingestion: override.audience_signal_ingestion }
      : {}),
    ...(override.agent_human_response_mode
      ? { agent_human_response_mode: override.agent_human_response_mode }
      : {}),
    ...(override.stage_open_reply ? { stage_open_reply: override.stage_open_reply } : {}),
    ...(override.audience_lane ? { audience_lane: override.audience_lane } : {}),
  }
}

type PendingUpdate = {
  post_id: string
  participation_contract_override_json: Prisma.InputJsonObject
  next_legacy_metadata_json: Prisma.InputJsonObject | null
}

type LegacyPostRow = {
  id: string
  legacy_metadata_json: Prisma.JsonValue | null
  participation_contract_override_json: Prisma.JsonValue | null
}

type MutableJsonRecord = Record<string, Prisma.InputJsonValue>

async function main() {
  const prisma = getPrismaClient()
  const apply = hasFlag('apply')
  const batchSize = parsePositiveInt(readArg('batch-size'), 100)
  const tableExistsRows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS "exists"
    `,
    'posts',
  )
  const tableAvailable = tableExistsRows[0]?.exists === true
  if (!tableAvailable) {
    console.log(JSON.stringify({
      apply,
      environment_ready: false,
      table_available: false,
      table_error: 'table is missing in the current database',
      scanned_rows: 0,
      rows_with_legacy_key: 0,
      rows_ready_for_backfill: 0,
      rows_with_conflicts: 0,
      rows_with_invalid_legacy_override: 0,
      updated_rows: 0,
      remaining_legacy_rows: 0,
      conflict_examples: [],
      invalid_examples: [],
      recommended_follow_up: [
        'pnpm db:local:up',
        'pnpm db:local:wait',
        'pnpm db:migrate:deploy',
        'pnpm forum:audit:participation-contract-overrides',
      ],
    }, null, 2))
    process.exitCode = 1
    return
  }
  const availableColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name IN ('moderation_metadata_json', 'participation_contract_override_json')
  `)
  const availableColumnSet = new Set(availableColumns.map((row) => row.column_name))
  const legacyColumnAvailable = availableColumnSet.has('moderation_metadata_json')
  const canonicalColumnAvailable = availableColumnSet.has('participation_contract_override_json')

  if (!canonicalColumnAvailable) {
    console.log(JSON.stringify({
      apply,
      environment_ready: false,
      table_available: true,
      legacy_column_available: legacyColumnAvailable,
      canonical_column_available: canonicalColumnAvailable,
      table_error: 'participation_contract_override_json column is missing in the current database',
      scanned_rows: 0,
      rows_with_legacy_key: 0,
      rows_ready_for_backfill: 0,
      rows_with_conflicts: 0,
      rows_with_invalid_legacy_override: 0,
      updated_rows: 0,
      remaining_legacy_rows: 0,
      conflict_examples: [],
      invalid_examples: [],
      recommended_follow_up: [
        'pnpm exec prisma validate',
        'pnpm exec prisma migrate deploy',
        'pnpm forum:audit:participation-contract-overrides',
      ],
    }, null, 2))
    process.exitCode = 1
    return
  }

  if (!legacyColumnAvailable) {
    console.log(JSON.stringify({
      apply,
      environment_ready: true,
      table_available: true,
      legacy_column_available: legacyColumnAvailable,
      canonical_column_available: canonicalColumnAvailable,
      scanned_rows: 0,
      rows_with_legacy_key: 0,
      rows_ready_for_backfill: 0,
      rows_with_conflicts: 0,
      rows_with_invalid_legacy_override: 0,
      updated_rows: 0,
      remaining_legacy_rows: 0,
      conflict_examples: [],
      invalid_examples: [],
      recommended_follow_up: [],
    }, null, 2))
    return
  }

  const rows = await prisma.$queryRawUnsafe<LegacyPostRow[]>(`
    SELECT
      id,
      moderation_metadata_json AS "legacy_metadata_json",
      participation_contract_override_json AS "participation_contract_override_json"
    FROM posts
  `)

  const updates: PendingUpdate[] = []
  const conflictExamples: Array<Record<string, unknown>> = []
  const invalidExamples: Array<Record<string, unknown>> = []

  let rowsWithLegacyKey = 0
  let rowsReadyForBackfill = 0
  let rowsWithConflicts = 0
  let rowsWithInvalidLegacyOverride = 0

  for (const row of rows) {
    if (!isRecord(row.legacy_metadata_json) || !(LEGACY_METADATA_KEY in row.legacy_metadata_json)) {
      continue
    }

    rowsWithLegacyKey += 1

    const legacyOverride = normalizeOverride(row.legacy_metadata_json[LEGACY_METADATA_KEY])
    const canonicalOverride = normalizeOverride(row.participation_contract_override_json)

    if (!legacyOverride) {
      rowsWithInvalidLegacyOverride += 1
      invalidExamples.push({
        post_id: row.id,
        legacy_value: row.legacy_metadata_json[LEGACY_METADATA_KEY],
      })
      continue
    }

    const serializedLegacy = serializeOverride(legacyOverride)
    const serializedCanonical = canonicalOverride ? serializeOverride(canonicalOverride) : null

    if (serializedCanonical && JSON.stringify(serializedCanonical) !== JSON.stringify(serializedLegacy)) {
      rowsWithConflicts += 1
      conflictExamples.push({
        post_id: row.id,
        legacy_override: serializedLegacy,
        canonical_override: serializedCanonical,
      })
      continue
    }

    const nextLegacyMetadata = { ...row.legacy_metadata_json } as MutableJsonRecord
    delete nextLegacyMetadata[LEGACY_METADATA_KEY]

    updates.push({
      post_id: row.id,
      participation_contract_override_json: serializedCanonical ?? serializedLegacy,
      next_legacy_metadata_json:
        Object.keys(nextLegacyMetadata).length > 0
          ? nextLegacyMetadata as Prisma.InputJsonObject
          : null,
    })
    rowsReadyForBackfill += 1
  }

  if (apply && (rowsWithConflicts > 0 || rowsWithInvalidLegacyOverride > 0)) {
    throw new Error(
      `Refusing to apply with ${rowsWithConflicts} conflict row(s) and ${rowsWithInvalidLegacyOverride} invalid legacy row(s)`,
    )
  }

  let updatedRows = 0
  if (apply) {
    for (let index = 0; index < updates.length; index += batchSize) {
      const batch = updates.slice(index, index + batchSize)
      await Promise.all(batch.map((entry) => prisma.$executeRawUnsafe(
        `
          UPDATE posts
          SET
            participation_contract_override_json = $1::jsonb,
            moderation_metadata_json = $2::jsonb
          WHERE id = $3
        `,
        JSON.stringify(entry.participation_contract_override_json),
        entry.next_legacy_metadata_json ? JSON.stringify(entry.next_legacy_metadata_json) : null,
        entry.post_id,
      )))
      updatedRows += batch.length
    }
  }

  const blockingRows = rowsWithConflicts + rowsWithInvalidLegacyOverride
  const remainingLegacyRows = apply ? blockingRows : rowsWithLegacyKey

  console.log(JSON.stringify({
    apply,
    scanned_rows: rows.length,
    rows_with_legacy_key: rowsWithLegacyKey,
    rows_ready_for_backfill: rowsReadyForBackfill,
    rows_with_conflicts: rowsWithConflicts,
    rows_with_invalid_legacy_override: rowsWithInvalidLegacyOverride,
    updated_rows: updatedRows,
    remaining_legacy_rows: remainingLegacyRows,
    conflict_examples: conflictExamples.slice(0, 10),
    invalid_examples: invalidExamples.slice(0, 10),
    recommended_follow_up: apply
      ? ['pnpm forum:audit:participation-contract-overrides']
      : rowsWithLegacyKey > 0
        ? ['pnpm forum:backfill:participation-contract-overrides']
        : [],
  }, null, 2))

  if (remainingLegacyRows > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('[participation-contract-backfill] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectPrisma()
  })
