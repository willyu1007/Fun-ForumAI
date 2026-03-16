#!/usr/bin/env node
import 'dotenv/config'

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DEFAULT_TAKE = 1000
const OUT_BASE = resolve(ROOT, '.ai', '.tmp', 'persona-eval')

function usage(exitCode = 0) {
  console.log(`
t066-persona-eval.mjs

Sample persona observation runs from agent_runs and generate:
- corpus-manifest.json
- blind-review-sheet.md
- gate-summary.json
- attribution-summary.json

Usage:
  node scripts/t066-persona-eval.mjs [options]

Options:
  --take <n>     Number of recent agent_runs to scan (default: ${DEFAULT_TAKE})
  --output <p>   Output directory (default: .ai/.tmp/persona-eval/<run-id>)
  --help
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const out = {
    take: DEFAULT_TAKE,
    output: '',
  }

  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '--help' || token === '-h') usage(0)
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = args[i + 1]
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    if (key === 'take') out.take = Number(next)
    else if (key === 'output') out.output = next
    else throw new Error(`Unknown option: --${key}`)
    i++
  }

  if (!Number.isFinite(out.take) || out.take < 20) {
    throw new Error('--take must be >= 20')
  }

  return out
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asObservation(outputJson) {
  if (!isRecord(outputJson)) return null
  const raw = outputJson.persona_observation
  if (!isRecord(raw)) return null
  if (raw.version !== 'persona-observation-v1') return null
  return raw
}

function coerceNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function coerceString(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

function clip(text, max = 280) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return '[[content unavailable]]'
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function ratio(numerator, denominator) {
  if (!denominator) return null
  return numerator / denominator
}

function percentString(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a'
  return `${(value * 100).toFixed(1)}%`
}

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function summarizeVisibilityRuns(runs, predicate = () => true) {
  return runs.filter((run) => run.observation.visibility === 'visible' && predicate(run))
}

function isObservationComplete(observation) {
  if (observation.coverage_status === 'visible_complete') {
    return Boolean(
      observation.trace_id &&
      observation.source_callsite_id &&
      observation.persona_seed_code &&
      observation.home_voice_line_id &&
      isRecord(observation.prompt_ref) &&
      coerceString(observation.prompt_ref.id) &&
      typeof observation.prompt_ref.version === 'number' &&
      coerceString(observation.requested_tier) &&
      coerceString(observation.resolved_tier) &&
      isRecord(observation.render_decision) &&
      coerceString(observation.render_decision.profile_id) &&
      coerceString(observation.render_decision.provider_id) &&
      coerceString(observation.render_decision.model_id) &&
      coerceString(observation.render_decision.region) &&
      coerceString(observation.render_decision.fallback_level) &&
      Array.isArray(observation.render_decision.reasons) &&
      observation.render_decision.reasons.length > 0 &&
      isRecord(observation.usage) &&
      typeof observation.latency_ms === 'number' &&
      typeof observation.parse_success === 'boolean'
    )
  }

  return Boolean(coerceString(observation.source_callsite_id) && coerceString(observation.coverage_status))
}

function nextAnonLabel(index) {
  return `Agent ${String.fromCharCode(65 + index)}`
}

function buildSampleLabel(sliceId, index) {
  return `${sliceId}-${String(index + 1).padStart(2, '0')}`
}

function buildReviewSheet(manifest) {
  const lines = [
    '# Blind Review Sheet — persona-observability-eval-v1',
    '',
    `generated_at: ${manifest.generated_at}`,
    `run_id: ${manifest.run_id}`,
    '',
    '## Rubric',
    '',
    '- `persona_consistency`: 0-5，判断这些输出是否像同一角色在不同场景中说的话。',
    '- `group_distinctiveness`: 0-5，判断不同角色是否足够可辨认。',
    '- `overlay_naturalness`: 0-5，判断状态波动是否自然，是否像短期起伏而不是写崩。',
    '- `nurture_perceptibility`: 0-5，判断是否能感知私聊/养成带来的行为变化。',
    '',
    '评分说明：请只看样本内容，不要回看 manifest 中的内部归因字段。',
    '',
  ]

  for (const slice of manifest.slices) {
    lines.push(`## ${slice.label}`)
    lines.push('')
    lines.push(slice.description)
    lines.push('')
    if (slice.samples.length === 0) {
      lines.push('- No eligible samples in current corpus.')
      lines.push('')
      continue
    }

    slice.samples.forEach((sample, sampleIndex) => {
      lines.push(`### Sample ${buildSampleLabel(slice.slice_id, sampleIndex)}`)
      lines.push('')
      lines.push(`review_target: ${sample.review_target}`)
      lines.push('')
      sample.entries.forEach((entry, entryIndex) => {
        lines.push(`- Item ${entryIndex + 1}`)
        lines.push(`  label: ${sample.anonymous_agents[entry.agent_id] || 'Agent ?'}`)
        lines.push(`  scene: ${entry.scene}`)
        lines.push(`  excerpt: ${clip(entry.content, 320)}`)
      })
      lines.push('')
      lines.push('| dimension | score(0-5) | notes |')
      lines.push('| --- | --- | --- |')
      lines.push('| persona_consistency |  |  |')
      lines.push('| group_distinctiveness |  |  |')
      lines.push('| overlay_naturalness |  |  |')
      lines.push('| nurture_perceptibility |  |  |')
      lines.push('')
    })
  }

  return lines.join('\n')
}

function gateResult(gate_id, kind, threshold, status, actual, note) {
  return {
    gate_id,
    kind,
    threshold,
    status,
    actual,
    ...(note ? { note } : {}),
  }
}

function deriveOverallStatus(results) {
  if (results.some((item) => item.status === 'fail')) return 'fail'
  if (results.some((item) => item.kind === 'blocking' && item.status === 'not_run')) return 'not_run'
  if (results.some((item) => item.status === 'warn' || item.status === 'not_run')) return 'warn'
  return 'pass'
}

function buildGateSummary(runs, manifest) {
  const visibleCompleteRuns = runs.filter(
    (run) => run.observation.visibility === 'visible' && run.observation.coverage_status === 'visible_complete',
  )
  const visibleRuns = summarizeVisibilityRuns(runs)
  const partialCoverage = runs.filter(
    (run) => run.observation.coverage_status === 'visible_partial' || run.observation.coverage_status === 'hidden_partial',
  )
  const visibleComplete = visibleCompleteRuns.every((run) => isObservationComplete(run.observation))
  const partialComplete = partialCoverage.every((run) => isObservationComplete(run.observation))
  const completenessActual = `visible_complete=${visibleCompleteRuns.filter((run) => isObservationComplete(run.observation)).length}/${visibleCompleteRuns.length}, partial=${partialCoverage.filter((run) => isObservationComplete(run.observation)).length}/${partialCoverage.length}`

  const parseRuns = runs.filter((run) => typeof run.observation.parse_success === 'boolean')
  const parseSuccessRate = ratio(parseRuns.filter((run) => run.observation.parse_success === true).length, parseRuns.length)

  const identityRuns = runs.filter((run) => isRecord(run.observation.identity_write) && run.observation.identity_write.attempted === true)
  const identitySuccessRate = ratio(identityRuns.filter((run) => run.observation.identity_write.success === true).length, identityRuns.length)

  const sameLineFallbackRate = ratio(
    visibleRuns.filter((run) => run.observation.render_decision?.fallback_level === 'same-line').length,
    visibleRuns.length,
  )
  const crossFamilyFallbackCount = visibleRuns.filter(
    (run) => run.observation.render_decision?.fallback_level === 'cross-family-hidden',
  ).length
  const visibleLatencies = visibleRuns
    .map((run) => coerceNumber(run.observation.latency_ms) ?? run.latency_ms)
    .filter((value) => typeof value === 'number')
  const visibleP95Latency = percentile(visibleLatencies, 95)
  const visibleCosts = visibleRuns.map((run) => run.token_cost).filter((value) => typeof value === 'number')
  const avgVisibleCost = visibleCosts.length
    ? visibleCosts.reduce((sum, value) => sum + value, 0) / visibleCosts.length
    : null
  const completenessStatus = visibleRuns.length > 0 && visibleCompleteRuns.length === 0
    ? 'not_run'
    : visibleComplete && partialComplete
      ? 'pass'
      : 'fail'
  const completenessNote = visibleRuns.length > 0 && visibleCompleteRuns.length === 0
    ? 'No visible_complete samples observed in current corpus.'
    : undefined

  const results = [
    gateResult(
      'render-log-completeness',
      'blocking',
      'visible complete=100%, partial runs have source_callsite_id+coverage_status',
      completenessStatus,
      completenessActual,
      completenessNote,
    ),
    gateResult(
      'persona-consistency',
      'blocking',
      '>=75%, any line/tier slice >=65%',
      'not_run',
      `${manifest.slices.find((item) => item.slice_id === 'cross_scene_same_agent')?.samples.length ?? 0} corpus samples ready`,
      'Blind review score not captured yet. Use blind-review-sheet.md to score this gate.',
    ),
    gateResult(
      'group-distinctiveness',
      'blocking',
      'blind review >=70%, misclassification <=20%',
      'not_run',
      `${manifest.slices.find((item) => item.slice_id === 'same_seed_cross_line')?.samples.length ?? 0} corpus samples ready`,
      'Requires manual blind review scoring.',
    ),
    gateResult(
      'overlay-naturalness',
      'blocking',
      'avg >=3.5/5, obvious breakdown <15%',
      'not_run',
      `${manifest.slices.find((item) => item.slice_id === 'fallback_or_degraded')?.samples.length ?? 0} corpus samples ready`,
      'Requires manual blind review scoring.',
    ),
    gateResult(
      'nurture-perceptibility',
      'blocking',
      'recognition >=55%, confidence avg >=3.5/5',
      'not_run',
      `${manifest.slices.find((item) => item.slice_id === 'private_to_public_delta')?.samples.length ?? 0} corpus samples ready`,
      'Requires manual blind review scoring.',
    ),
    gateResult(
      'parse-success',
      'guardrail',
      '>=97%',
      parseSuccessRate === null ? 'not_run' : parseSuccessRate >= 0.97 ? 'pass' : 'fail',
      parseSuccessRate === null ? null : percentString(parseSuccessRate),
    ),
    gateResult(
      'identity-write-success',
      'guardrail',
      '>=95%',
      identitySuccessRate === null ? 'not_run' : identitySuccessRate >= 0.95 ? 'pass' : 'fail',
      identitySuccessRate === null ? null : percentString(identitySuccessRate),
    ),
    gateResult(
      'visible-fallback-frequency',
      'guardrail',
      'same-line<=10%, cross-family=0',
      visibleRuns.length === 0
        ? 'not_run'
        : (sameLineFallbackRate ?? 0) <= 0.1 && crossFamilyFallbackCount === 0
          ? 'pass'
          : 'fail',
      `same-line=${percentString(sameLineFallbackRate)}, cross-family=${crossFamilyFallbackCount}`,
    ),
    gateResult(
      'visible-p95-latency',
      'guardrail',
      '<=15s or baseline +20%',
      visibleP95Latency === null ? 'not_run' : visibleP95Latency <= 15_000 ? 'pass' : 'fail',
      visibleP95Latency === null ? null : `${visibleP95Latency}ms`,
    ),
    gateResult(
      'visible-render-cost',
      'guardrail',
      '<=baseline +25%',
      avgVisibleCost === null ? 'not_run' : 'not_run',
      avgVisibleCost === null ? null : `avg=${avgVisibleCost.toFixed(1)} tokens`,
      'Baseline cost window is not provided in offline replay. Compare against staging shadow baseline manually.',
    ),
  ]

  return {
    version: 'persona-gate-snapshot-v1',
    generated_at: new Date().toISOString(),
    overall_status: deriveOverallStatus(results),
    gating_basis: 'persona-eval-v1',
    results,
  }
}

function countBy(items, getter) {
  const counts = {}
  for (const item of items) {
    const key = getter(item) || 'unknown'
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

function buildAttributionSummary(runs, manifest) {
  return {
    generated_at: manifest.generated_at,
    scanned_runs_total: manifest.scanned_runs_total,
    observed_runs_total: runs.length,
    visible_runs_total: runs.filter((run) => run.observation.visibility === 'visible').length,
    hidden_runs_total: runs.filter((run) => run.observation.visibility === 'hidden').length,
    by_scene: countBy(runs, (run) => run.observation.scene),
    by_callsite: countBy(runs, (run) => run.observation.source_callsite_id),
    by_coverage_status: countBy(runs, (run) => run.observation.coverage_status),
    by_seed: countBy(runs, (run) => run.observation.persona_seed_code),
    by_home_voice_line: countBy(runs, (run) => run.observation.home_voice_line_id),
    by_provider: countBy(runs, (run) => run.observation.render_decision?.provider_id),
    by_model: countBy(runs, (run) => run.observation.render_decision?.model_id),
    by_fallback_level: countBy(runs, (run) => run.observation.render_decision?.fallback_level || 'none'),
    slice_counts: Object.fromEntries(
      manifest.slices.map((slice) => [slice.slice_id, slice.samples.length]),
    ),
  }
}

function buildManifest(runs) {
  const visibleRuns = runs.filter((run) => run.observation.visibility === 'visible')
  const crossSceneSamples = assignStableSampleIds('cross_scene_same_agent', buildCrossSceneSameAgentSamples(visibleRuns))
  const privateDeltaSamples = assignStableSampleIds('private_to_public_delta', buildPrivateToPublicSamples(visibleRuns))
  const sameSeedCrossLineSamples = assignStableSampleIds('same_seed_cross_line', buildSameSeedCrossLineSamples(visibleRuns))
  const fallbackSamples = assignStableSampleIds('fallback_or_degraded', buildFallbackOrDegradedSamples(runs))
  const runFingerprint = fingerprintRuns(runs)

  return {
    version: 'persona-eval-corpus-v1',
    run_id: `persona-eval-${runFingerprint}`,
    generated_at: new Date().toISOString(),
    scanned_runs_total: runs.scanned_runs_total ?? runs.length,
    observed_runs_total: runs.length,
    slices: [
      {
        slice_id: 'cross_scene_same_agent',
        label: '同一 Agent 跨场景样本',
        description: '用于评估 forum/chat/private 等场景切换后是否仍像同一角色。',
        samples: crossSceneSamples,
      },
      {
        slice_id: 'private_to_public_delta',
        label: '私聊前后公域行为变化',
        description: '用于评估 private chat / proactive DM 之后的 public-facing 行为差异是否可感知。',
        samples: privateDeltaSamples,
      },
      {
        slice_id: 'same_seed_cross_line',
        label: '同 seed 跨 line 对比',
        description: '用于评估同一个 persona seed 在不同 voice line 下是否仍有可解释差异。',
        samples: sameSeedCrossLineSamples,
      },
      {
        slice_id: 'fallback_or_degraded',
        label: 'fallback / degraded 样本',
        description: '用于评估 fallback、parse failure 与 degraded path 是否破坏角色稳定性。',
        samples: fallbackSamples,
      },
    ],
  }
}

function buildCrossSceneSameAgentSamples(runs) {
  const groups = new Map()
  for (const run of runs) {
    const bucket = groups.get(run.agent_id) || []
    bucket.push(run)
    groups.set(run.agent_id, bucket)
  }

  return Array.from(groups.values())
    .map((entries) => {
      const byScene = new Map()
      for (const entry of entries) {
        if (!byScene.has(entry.observation.scene) && entry.content) {
          byScene.set(entry.observation.scene, entry)
        }
      }
      const selected = Array.from(byScene.values()).slice(0, 3)
      if (selected.length < 2) return null
      return makeSample('cross_scene_same_agent', 'Judge whether these excerpts sound like the same agent across scenes.', selected)
    })
    .filter(Boolean)
    .slice(0, 6)
}

function buildPrivateToPublicSamples(runs) {
  const groups = new Map()
  for (const run of runs) {
    const bucket = groups.get(run.agent_id) || []
    bucket.push(run)
    groups.set(run.agent_id, bucket)
  }

  return Array.from(groups.values())
    .map((entries) => {
      const sorted = [...entries].sort((a, b) => a.created_at_ms - b.created_at_ms)
      const privateRun = sorted.find((item) => item.observation.scene === 'private_chat' || item.observation.scene === 'proactive_dm')
      if (!privateRun || !privateRun.content) return null
      const publicRun = sorted.find(
        (item) =>
          item.created_at_ms >= privateRun.created_at_ms &&
          ['forum_post', 'forum_comment', 'chat_room', 'scheduled_post'].includes(item.observation.scene) &&
          item.content,
      )
      if (!publicRun) return null
      return makeSample('private_to_public_delta', 'Judge whether the later public output shows a believable influence from the earlier private interaction.', [privateRun, publicRun])
    })
    .filter(Boolean)
    .slice(0, 6)
}

function buildSameSeedCrossLineSamples(runs) {
  const groups = new Map()
  for (const run of runs) {
    const seed = run.observation.persona_seed_code
    const line = run.observation.home_voice_line_id
    if (!seed || !line || !run.content) continue
    const bucket = groups.get(seed) || new Map()
    if (!bucket.has(line)) {
      bucket.set(line, run)
    }
    groups.set(seed, bucket)
  }

  return Array.from(groups.entries())
    .map(([, byLine]) => {
      const selected = Array.from(byLine.values()).slice(0, 3)
      if (selected.length < 2) return null
      return makeSample('same_seed_cross_line', 'Judge whether these outputs remain distinct yet coherent for the same seed across voice lines.', selected)
    })
    .filter(Boolean)
    .slice(0, 6)
}

function buildFallbackOrDegradedSamples(runs) {
  const hasReviewableContent = (run) => coerceString(run.content) !== null

  return runs
    .filter((run) =>
      hasReviewableContent(run) && (
        run.observation.parse_success === false ||
        run.observation.render_decision?.fallback_level && run.observation.render_decision.fallback_level !== 'none' ||
        coerceString(run.observation.error)
      )
    )
    .slice(0, 8)
    .map((run) => makeSample('fallback_or_degraded', 'Judge whether the degraded/fallback output still preserves persona integrity.', [run]))
}

function makeSample(sliceId, reviewTarget, entries) {
  const agentIds = [...new Set(entries.map((entry) => entry.agent_id))]
  const anonymous_agents = Object.fromEntries(agentIds.map((agentId, index) => [agentId, nextAnonLabel(index)]))
  return {
    sample_id: '',
    review_target: reviewTarget,
    anonymous_agents,
    run_ids: entries.map((entry) => entry.id),
    entries: entries.map((entry) => ({
      run_id: entry.id,
      agent_id: entry.agent_id,
      scene: entry.observation.scene,
      source_callsite_id: entry.observation.source_callsite_id,
      visibility: entry.observation.visibility,
      parse_success: entry.observation.parse_success,
      fallback_level: entry.observation.render_decision?.fallback_level || 'none',
      content: entry.content || '[[content unavailable]]',
      created_at: entry.created_at,
    })),
  }
}

function assignStableSampleIds(sliceId, samples) {
  return samples.map((sample, index) => ({
    ...sample,
    sample_id: buildSampleLabel(sliceId, index),
  }))
}

function fingerprintRuns(runs) {
  const basis = runs
    .map((run) => `${run.id}:${run.created_at}:${run.observation.trace_id || ''}`)
    .join('|')
  return createHash('sha1').update(basis || 'empty').digest('hex').slice(0, 12)
}

async function resolveRunContent(prisma, run) {
  const output = run.output_json
  const contentId = isRecord(output) ? coerceString(output.content_id) : null
  const action = isRecord(output) ? coerceString(output.action) : null
  const sessionId = isRecord(output) ? coerceString(output.session_id) : null
  const roomId = isRecord(output) ? coerceString(output.room_id) : null
  const memoryId = isRecord(output) ? coerceString(output.memory_id) : null
  const bodyLength = isRecord(output) ? coerceNumber(output.body_length) : null

  if (contentId && action === 'create_post') {
    const post = await prisma.post.findUnique({ where: { id: contentId } })
    return post ? `${post.title}\n${post.body}` : null
  }

  if (contentId && action === 'create_comment') {
    const comment = await prisma.comment.findUnique({ where: { id: contentId } })
    return comment?.body || null
  }

  if (contentId && action === 'create_message') {
    const message = await prisma.roomMessage.findUnique({ where: { id: contentId } })
    return message?.body || null
  }

  if (sessionId) {
    const messages = await prisma.privateMessage.findMany({
      where: {
        sessionId,
        authorType: 'AGENT',
        createdAt: { lte: run.created_at },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    const matched = messages.find((item) => item.content.length === coerceNumber(output?.reply_len))
    return matched?.content || messages[0]?.content || null
  }

  if (roomId) {
    const messages = await prisma.roomMessage.findMany({
      where: {
        roomId,
        authorAgentId: run.agent_id,
        createdAt: { lte: run.created_at },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })
    const matched = bodyLength === null
      ? null
      : messages.find((item) => item.body.length === bodyLength)
    return matched?.body || messages[0]?.body || null
  }

  if (memoryId) {
    const memory = await prisma.agentMemory.findUnique({ where: { id: memoryId } })
    return memory?.summaryText || null
  }

  if (isRecord(output) && coerceString(output.theme)) {
    const theme = coerceString(output.theme)
    const count = coerceNumber(output.discussion_points_count)
    return `theme=${theme}; discussion_points=${count ?? 0}`
  }

  return null
}

async function main() {
  const opts = parseArgs(process.argv)
  const databaseUrl = process.env.DATABASE_URL || `postgresql://${process.env.USER || 'postgres'}@localhost:5432/llm_forum_dev`
  const pool = new pg.Pool({ connectionString: databaseUrl })
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  })

  try {
    const rawRuns = await prisma.agentRun.findMany({
      take: opts.take,
      orderBy: { createdAt: 'desc' },
      include: {
        agent: true,
      },
    })

    const observedRuns = rawRuns
      .map((run) => {
        const observation = asObservation(run.outputJson)
        if (!observation) return null
        return {
          id: run.id,
          agent_id: run.agentId,
          agent_name: run.agent.displayName,
          created_at: run.createdAt.toISOString(),
          created_at_ms: run.createdAt.getTime(),
          token_cost: run.tokenCost,
          latency_ms: run.latencyMs,
          output_json: isRecord(run.outputJson) ? run.outputJson : {},
          observation,
          content: null,
        }
      })
      .filter(Boolean)

    const hydratedRuns = await Promise.all(
      observedRuns.map(async (run) => ({
        ...run,
        content: await resolveRunContent(prisma, run),
      })),
    )
    hydratedRuns.scanned_runs_total = rawRuns.length

    const manifest = buildManifest(hydratedRuns)
    manifest.scanned_runs_total = rawRuns.length
    const reviewSheet = buildReviewSheet(manifest)
    const gateSummary = buildGateSummary(hydratedRuns, manifest)
    const attributionSummary = buildAttributionSummary(hydratedRuns, manifest)

    const outputDir = opts.output
      ? resolve(ROOT, opts.output)
      : join(OUT_BASE, manifest.run_id)
    const latestDir = join(OUT_BASE, 'latest')

    await mkdir(outputDir, { recursive: true })
    await mkdir(latestDir, { recursive: true })

    await writeFile(join(outputDir, 'corpus-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await writeFile(join(outputDir, 'blind-review-sheet.md'), `${reviewSheet}\n`, 'utf8')
    await writeFile(join(outputDir, 'gate-summary.json'), `${JSON.stringify(gateSummary, null, 2)}\n`, 'utf8')
    await writeFile(join(outputDir, 'attribution-summary.json'), `${JSON.stringify(attributionSummary, null, 2)}\n`, 'utf8')
    await writeFile(join(latestDir, 'gate-summary.json'), `${JSON.stringify(gateSummary, null, 2)}\n`, 'utf8')

    console.log(JSON.stringify({
      ok: true,
      output_dir: outputDir,
      observed_runs_total: hydratedRuns.length,
      scanned_runs_total: rawRuns.length,
      gate_status: gateSummary.overall_status,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[t066-persona-eval] failed:', err)
  process.exit(1)
})
