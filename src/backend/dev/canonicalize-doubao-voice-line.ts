import { Prisma } from '@prisma/client'
import { PERSONA_SEED_CATALOG } from '../../shared/agent-persona-catalog.js'

const LEGACY_VOICE_LINE_ID = 'kimi-deep-v1'
const CANONICAL_VOICE_LINE_ID = 'doubao-deep-v1'

interface LatestConfigRow {
  id: string
  agent_id: string
  config_json: unknown
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function toRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  return input as Record<string, unknown>
}

function replaceVoiceLineId(value: unknown): unknown {
  return value === LEGACY_VOICE_LINE_ID ? CANONICAL_VOICE_LINE_ID : value
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function canonicalizeConfigJson(configJson: unknown): Record<string, unknown> | null {
  const root = toRecord(configJson)
  if (!root) return null

  const next = structuredClone(root)
  const voice = toRecord(next.voice) ?? {}
  next.voice = {
    ...voice,
    homeVoiceLineId: CANONICAL_VOICE_LINE_ID,
  }

  const personaSeed = toRecord(next.personaSeed)
  if (personaSeed) {
    if (Array.isArray(personaSeed.compatibleVoiceLines)) {
      personaSeed.compatibleVoiceLines = dedupeStrings(
        personaSeed.compatibleVoiceLines
          .filter((value): value is string => typeof value === 'string')
          .map((value) => replaceVoiceLineId(value) as string),
      )
    } else if (personaSeed.seedCode === 'philosopher') {
      personaSeed.compatibleVoiceLines = [...PERSONA_SEED_CATALOG.philosopher.compatibleVoiceLines]
    }
    next.personaSeed = personaSeed
  }

  return next
}

async function loadLatestConfigRows(
  prisma: import('@prisma/client').PrismaClient,
  agentId?: string,
): Promise<LatestConfigRow[]> {
  return prisma.$queryRaw<LatestConfigRow[]>(Prisma.sql`
    SELECT id, agent_id, config_json
    FROM (
      SELECT DISTINCT ON (agent_id) id, agent_id, config_json, effective_at, updated_at
      FROM agent_configs
      ${agentId ? Prisma.sql`WHERE agent_id = ${agentId}` : Prisma.empty}
      ORDER BY agent_id, effective_at DESC, updated_at DESC
    ) latest
    WHERE (config_json -> 'voice' ->> 'homeVoiceLineId') = ${LEGACY_VOICE_LINE_ID}
  `)
}

async function reconcileSearchAgents(agentIds: string[]) {
  if (agentIds.length === 0) return []

  const { searchProjectionService, warmPersistenceState } = await import('../container.js')
  await warmPersistenceState()

  const results = []
  for (const agentId of agentIds) {
    results.push(
      await searchProjectionService.reconcileAgent(agentId, {
        reason: 'voice_line_canonicalization',
        scopes: ['agent'],
      }),
    )
  }
  return results
}

async function main() {
  process.env.DB_PERSISTENCE ??= 'true'
  const { disconnectPrisma, getPrismaClient } = await import('../persistence/prisma-client.js')

  const agentId = readArg('agent-id')
  const apply = hasFlag('apply')
  const explicitDryRun = hasFlag('dry-run')
  if (apply && explicitDryRun) {
    throw new Error('choose either --apply or --dry-run')
  }

  const prisma = getPrismaClient()

  try {
    const configRows = await loadLatestConfigRows(prisma, agentId)
    const inferenceProfiles = await prisma.agentInferenceProfile.findMany({
      where: {
        ...(agentId ? { agentId } : {}),
        challengerVoiceLineId: LEGACY_VOICE_LINE_ID,
      },
      select: { agentId: true },
    })
    const incumbentShadowReviews = await prisma.agentInferenceShadowReview.findMany({
      where: {
        ...(agentId ? { agentId } : {}),
        incumbentVoiceLineId: LEGACY_VOICE_LINE_ID,
      },
      select: { id: true, agentId: true },
    })
    const challengerShadowReviews = await prisma.agentInferenceShadowReview.findMany({
      where: {
        ...(agentId ? { agentId } : {}),
        challengerVoiceLineId: LEGACY_VOICE_LINE_ID,
      },
      select: { id: true, agentId: true },
    })

    const configRowsWithCanonicalJson = configRows.map((row) => ({
      ...row,
      nextConfigJson: canonicalizeConfigJson(row.config_json),
    }))
    const malformedConfigRows = configRowsWithCanonicalJson.filter((row) => row.nextConfigJson === null)
    const validConfigRows = configRowsWithCanonicalJson.filter(
      (row): row is LatestConfigRow & { nextConfigJson: Record<string, unknown> } =>
        row.nextConfigJson !== null,
    )
    const affectedAgentIds = dedupeStrings(validConfigRows.map((row) => row.agent_id))

    const summary = {
      mode: apply ? 'apply' : 'dry-run',
      agent_id: agentId ?? null,
      legacy_voice_line_id: LEGACY_VOICE_LINE_ID,
      canonical_voice_line_id: CANONICAL_VOICE_LINE_ID,
      counts: {
        latest_agent_configs: validConfigRows.length,
        malformed_latest_agent_configs: malformedConfigRows.length,
        inference_profiles: inferenceProfiles.length,
        shadow_reviews_incumbent: incumbentShadowReviews.length,
        shadow_reviews_challenger: challengerShadowReviews.length,
        affected_agents: affectedAgentIds.length,
      },
      affected_agent_ids: affectedAgentIds,
    }

    if (!apply) {
      console.log(JSON.stringify({
        ...summary,
        next_steps: [
          'rerun with --apply to persist canonical voice-line ids',
          'after apply, rebuild agent search docs through the existing reconcile path',
        ],
      }, null, 2))
      return
    }

    await prisma.$transaction(async (tx) => {
      for (const row of validConfigRows) {
        await tx.agentConfig.update({
          where: { id: row.id },
          data: {
            configJson: row.nextConfigJson as Prisma.InputJsonValue,
          },
        })
      }

      await tx.agentInferenceProfile.updateMany({
        where: {
          ...(agentId ? { agentId } : {}),
          challengerVoiceLineId: LEGACY_VOICE_LINE_ID,
        },
        data: {
          challengerVoiceLineId: CANONICAL_VOICE_LINE_ID,
        },
      })

      await tx.agentInferenceShadowReview.updateMany({
        where: {
          ...(agentId ? { agentId } : {}),
          incumbentVoiceLineId: LEGACY_VOICE_LINE_ID,
        },
        data: {
          incumbentVoiceLineId: CANONICAL_VOICE_LINE_ID,
        },
      })

      await tx.agentInferenceShadowReview.updateMany({
        where: {
          ...(agentId ? { agentId } : {}),
          challengerVoiceLineId: LEGACY_VOICE_LINE_ID,
        },
        data: {
          challengerVoiceLineId: CANONICAL_VOICE_LINE_ID,
        },
      })
    })

    const reconcileResults = await reconcileSearchAgents(affectedAgentIds)

    console.log(JSON.stringify({
      ...summary,
      search_reconcile: {
        refreshed_agents: reconcileResults.length,
        results: reconcileResults,
      },
    }, null, 2))
  } finally {
    await disconnectPrisma()
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[canonicalize-doubao-voice-line] failed', error)
    process.exit(1)
  })
