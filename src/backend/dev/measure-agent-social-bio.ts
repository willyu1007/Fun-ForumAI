import { disconnectPrisma, getPrismaClient } from '../persistence/prisma-client.js'
import {
  containsGenericPlaceholderLexicon,
  containsMetaLexicon,
} from '../domain/agent-bio/index.js'

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = readArg(name)
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Number((numerator / denominator).toFixed(4))
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

async function main() {
  process.env.DB_PERSISTENCE ??= 'true'
  const prisma = getPrismaClient()
  const sampleSize = parsePositiveInt('sample-size', 8)
  const recentDays = parsePositiveInt('recent-days', 30)
  const registryProfile = readArg('registry-profile')
  const recentSince = new Date(Date.now() - recentDays * 24 * 3_600_000)

  const scopedRegistryRows = registryProfile
    ? await prisma.devSeedRegistryEntry.findMany({
        where: { profile: registryProfile },
        select: { entityType: true, entityId: true },
      })
    : []
  const scopedAgentIds = new Set(
    scopedRegistryRows
      .filter((row) => row.entityType === 'agent')
      .map((row) => row.entityId),
  )
  const scopedPostIds = new Set(
    scopedRegistryRows
      .filter((row) => row.entityType === 'post')
      .map((row) => row.entityId),
  )
  const scopedThreadIds = new Set(
    scopedRegistryRows
      .filter((row) => row.entityType === 'thread')
      .map((row) => row.entityId),
  )
  const agentIdFilter = registryProfile
    ? { id: { in: [...scopedAgentIds] } }
    : undefined
  const projectionAgentFilter = registryProfile
    ? { agentId: { in: [...scopedAgentIds] } }
    : undefined

  // Keep queries sequential so this audit script remains stable under local dev load.
  const activeAgentCount = await prisma.agent.count({
    where: {
      status: 'ACTIVE',
      ...(agentIdFilter ?? {}),
    },
  })
  const projections = await prisma.agentBioProjection.findMany({
    where: projectionAgentFilter,
    select: {
      agentId: true,
      publicBio: true,
      ownerBio: true,
      privateHeaderBio: true,
      presenceNote: true,
      refreshedAt: true,
      renderPolicyJson: true,
    },
  })
  const renderLogs = await prisma.agentBioRenderLog.findMany({
    where: {
      ...(projectionAgentFilter ?? {}),
      createdAt: {
        gte: recentSince,
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      agentId: true,
      refreshKind: true,
      status: true,
      noteJson: true,
      createdAt: true,
    },
  })
  const agentSearchDocs = await prisma.agentSearchDoc.findMany({
    where: registryProfile
      ? { agentId: { in: [...scopedAgentIds] } }
      : undefined,
    select: {
      agentId: true,
      publicBio: true,
      publicTagline: true,
    },
  })
  const postSearchDocs = await prisma.postSearchDoc.findMany({
    where: registryProfile
      ? { postId: { in: [...scopedPostIds] } }
      : undefined,
    select: {
      postId: true,
      authorAgentId: true,
      authorPublicBio: true,
      authorTagline: true,
    },
  })
  const threadSearchDocs = await prisma.threadSearchDoc.findMany({
    where: registryProfile
      ? { threadId: { in: [...scopedThreadIds] } }
      : undefined,
    select: {
      threadId: true,
      authorAgentId: true,
      authorPublicBio: true,
      authorTagline: true,
    },
  })
  const samples = await prisma.agentBioProjection.findMany({
    where: projectionAgentFilter,
    orderBy: { refreshedAt: 'desc' },
    take: sampleSize,
    select: {
      refreshedAt: true,
      publicBio: true,
      ownerBio: true,
      presenceNote: true,
      renderPolicyJson: true,
      agent: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  })

  const familyDistribution = new Map<string, number>()
  const currentProjectionFamilyDistribution = new Map<string, number>()
  const refreshKindCounts = new Map<string, number>()
  const statusCounts = new Map<string, number>()
  const projectionsByAgentId = new Map(projections.map((row) => [row.agentId, row]))
  let candidateRejections = 0
  let privacyViolationCount = 0

  for (const log of renderLogs) {
    refreshKindCounts.set(log.refreshKind, (refreshKindCounts.get(log.refreshKind) ?? 0) + 1)
    statusCounts.set(log.status, (statusCounts.get(log.status) ?? 0) + 1)
    const note = readRecord(log.noteJson)
    const selectedFamilies = readRecord(note.selected_families)
    const publicFamily = typeof selectedFamilies.public === 'string' ? selectedFamilies.public : null
    if (publicFamily) {
      familyDistribution.set(publicFamily, (familyDistribution.get(publicFamily) ?? 0) + 1)
    }
    const rejections = Array.isArray(note.candidate_rejections) ? note.candidate_rejections.length : 0
    const privacyViolations = Array.isArray(note.privacy_violations) ? note.privacy_violations.length : 0
    candidateRejections += rejections
    privacyViolationCount += privacyViolations
  }
  for (const projection of projections) {
    const renderPolicy = readRecord(projection.renderPolicyJson)
    const selectedFamilies = readRecord(renderPolicy.selected_families)
    const publicFamily = typeof selectedFamilies.public === 'string' ? selectedFamilies.public : null
    if (publicFamily) {
      currentProjectionFamilyDistribution.set(
        publicFamily,
        (currentProjectionFamilyDistribution.get(publicFamily) ?? 0) + 1,
      )
    }
  }

  const projectionCoverage = {
    active_agents: activeAgentCount,
    projections: projections.length,
    projection_coverage_ratio: ratio(projections.length, activeAgentCount),
    public_bio_present: projections.filter((row) => hasText(row.publicBio)).length,
    owner_bio_present: projections.filter((row) => hasText(row.ownerBio)).length,
    private_header_present: projections.filter((row) => hasText(row.privateHeaderBio)).length,
    presence_note_present: projections.filter((row) => hasText(row.presenceNote)).length,
  }
  const publicMetaLeakCount = projections.filter((row) =>
    hasText(row.publicBio) && containsMetaLexicon(row.publicBio ?? '', null)).length
  const publicGenericPlaceholderCount = projections.filter((row) =>
    hasText(row.publicBio) && containsGenericPlaceholderLexicon(row.publicBio ?? '', null)).length

  const familyValues = [...familyDistribution.values()]
  const maxFamilyCount = familyValues.length > 0 ? Math.max(...familyValues) : 0
  const renderQualityTotal = familyValues.reduce((sum, value) => sum + value, 0)
  const currentProjectionFamilyValues = [...currentProjectionFamilyDistribution.values()]
  const currentProjectionMaxFamilyCount = currentProjectionFamilyValues.length > 0
    ? Math.max(...currentProjectionFamilyValues)
    : 0
  const currentProjectionFamilyTotal = currentProjectionFamilyValues.reduce((sum, value) => sum + value, 0)

  const searchProjectionConsistency = {
    agent_docs_mismatch: agentSearchDocs.filter((row) =>
      (projectionsByAgentId.get(row.agentId)?.publicBio ?? null) !== (row.publicBio ?? null)).length,
    post_docs_mismatch: postSearchDocs.filter((row) =>
      (projectionsByAgentId.get(row.authorAgentId)?.publicBio ?? null) !== (row.authorPublicBio ?? null)).length,
    thread_docs_mismatch: threadSearchDocs.filter((row) =>
      (projectionsByAgentId.get(row.authorAgentId)?.publicBio ?? null) !== (row.authorPublicBio ?? null)).length,
  }

  const fallbackRatio = {
    agent_search_docs: {
      total: agentSearchDocs.length,
      using_tagline_fallback: agentSearchDocs.filter((row) => !hasText(row.publicBio) && hasText(row.publicTagline)).length,
    },
    post_search_docs: {
      total: postSearchDocs.length,
      using_tagline_fallback: postSearchDocs.filter((row) => !hasText(row.authorPublicBio) && hasText(row.authorTagline)).length,
    },
    thread_search_docs: {
      total: threadSearchDocs.length,
      using_tagline_fallback: threadSearchDocs.filter((row) => !hasText(row.authorPublicBio) && hasText(row.authorTagline)).length,
    },
  }

  const output = {
    window: {
      recent_days: recentDays,
      sample_size: sampleSize,
      sampled_since: recentSince.toISOString(),
      registry_profile: registryProfile ?? null,
    },
    coverage: projectionCoverage,
    fallback_ratio: {
      agent_search_docs: {
        ...fallbackRatio.agent_search_docs,
        ratio: ratio(
          fallbackRatio.agent_search_docs.using_tagline_fallback,
          fallbackRatio.agent_search_docs.total,
        ),
      },
      post_search_docs: {
        ...fallbackRatio.post_search_docs,
        ratio: ratio(
          fallbackRatio.post_search_docs.using_tagline_fallback,
          fallbackRatio.post_search_docs.total,
        ),
      },
      thread_search_docs: {
        ...fallbackRatio.thread_search_docs,
        ratio: ratio(
          fallbackRatio.thread_search_docs.using_tagline_fallback,
          fallbackRatio.thread_search_docs.total,
        ),
      },
    },
    render_quality: {
      render_log_count: renderLogs.length,
      refresh_kind_distribution: Object.fromEntries(refreshKindCounts.entries()),
      render_status_distribution: Object.fromEntries(statusCounts.entries()),
      family_distribution: Object.fromEntries(familyDistribution.entries()),
      max_family_ratio: ratio(maxFamilyCount, renderQualityTotal),
      current_projection_family_distribution: Object.fromEntries(currentProjectionFamilyDistribution.entries()),
      current_projection_max_family_ratio: ratio(
        currentProjectionMaxFamilyCount,
        currentProjectionFamilyTotal,
      ),
      avg_candidate_rejections_per_log: renderLogs.length > 0
        ? Number((candidateRejections / renderLogs.length).toFixed(2))
        : 0,
      avg_privacy_violations_per_log: renderLogs.length > 0
        ? Number((privacyViolationCount / renderLogs.length).toFixed(2))
        : 0,
    },
    quality_guard: {
      public_meta_leak_count: publicMetaLeakCount,
      public_generic_placeholder_count: publicGenericPlaceholderCount,
      projection_search_consistency: searchProjectionConsistency,
    },
    naturalness_sample: samples.map((row) => {
      const renderPolicy = readRecord(row.renderPolicyJson)
      const selectedFamilies = readRecord(renderPolicy.selected_families)
      return {
        agent_id: row.agent.id,
        display_name: row.agent.displayName,
        refreshed_at: row.refreshedAt.toISOString(),
        public_bio: row.publicBio,
        owner_bio: row.ownerBio,
        presence_note: row.presenceNote,
        public_family: typeof selectedFamilies.public === 'string' ? selectedFamilies.public : null,
        render_mode: typeof renderPolicy.render_mode === 'string' ? renderPolicy.render_mode : null,
      }
    }),
  }

  console.log(JSON.stringify(output, null, 2))
}

main()
  .then(async () => {
    await disconnectPrisma()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('[agent-social-bio-measure] failed', error)
    await disconnectPrisma()
    process.exit(1)
  })
