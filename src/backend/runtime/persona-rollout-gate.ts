import type { PersonaGateResultV1, PersonaGateSnapshotV1, PersonaGateStatus } from './persona-observation.js'

export const PERSONA_T070_BLOCKING_CALLSITES = [
  'post-scheduler-create-post',
  'private-channel-reply',
] as const

export const PERSONA_T070_OPPORTUNISTIC_CALLSITES = [
  'agent-executor-forum-post',
  'agent-executor-forum-thread',
  'conversation-clock-chat-reply',
  'proactive-orchestrated-opening',
] as const

export const PERSONA_T070_REQUIRED_SLICES = [
  'cross_scene_same_agent',
  'private_to_public_delta',
  'fallback_or_degraded',
] as const

export const PERSONA_T070_OPTIONAL_SLICES = [
  'same_seed_cross_line',
] as const

export const PERSONA_T070_REVIEW_DIMENSIONS = [
  'persona_consistency',
  'group_distinctiveness',
  'overlay_naturalness',
  'nurture_perceptibility',
] as const

export type PersonaRolloutCallsiteId =
  | typeof PERSONA_T070_BLOCKING_CALLSITES[number]
  | typeof PERSONA_T070_OPPORTUNISTIC_CALLSITES[number]

export type PersonaRolloutSliceId =
  | typeof PERSONA_T070_REQUIRED_SLICES[number]
  | typeof PERSONA_T070_OPTIONAL_SLICES[number]

export type PersonaBlindReviewMode = 'collaborative' | 'manual' | 'agent_rehearsal'
export type PersonaBlindReviewDimensionId = typeof PERSONA_T070_REVIEW_DIMENSIONS[number]
export type PersonaRolloutRecommendation = 'go' | 'go_with_caveats' | 'hold' | 'rollback'

export interface PersonaEvalManifestEntry {
  run_id: string
  agent_id: string
  scene: string
  source_callsite_id: string
  visibility: string
  parse_success?: boolean
  fallback_level?: string
  content: string
  created_at: string
}

export interface PersonaEvalManifestSample {
  sample_id: string
  review_target: string
  run_ids: string[]
  entries: PersonaEvalManifestEntry[]
}

export interface PersonaEvalManifestSlice {
  slice_id: PersonaRolloutSliceId
  label: string
  description: string
  samples: PersonaEvalManifestSample[]
}

export interface PersonaEvalCorpusManifestV1 {
  version: 'persona-eval-corpus-v1'
  run_id: string
  generated_at: string
  scanned_runs_total: number
  observed_runs_total: number
  slices: PersonaEvalManifestSlice[]
}

export interface PersonaEvalAttributionSummaryV1 {
  generated_at: string
  scanned_runs_total: number
  observed_runs_total: number
  visible_runs_total: number
  hidden_runs_total: number
  by_callsite: Record<string, number>
  by_provider: Record<string, number>
  by_model: Record<string, number>
  by_policy?: Record<string, number>
  by_adapter?: Record<string, number>
  by_credential?: Record<string, number>
  by_provider_model?: Record<string, number>
  fallback_history_total?: number
  fallback_entry_total?: number
  slice_counts: Record<string, number>
}

export interface PersonaRuntimeIdentityDeltaV1 {
  before_success_total: number
  before_failure_total: number
  after_success_total: number
  after_failure_total: number
}

export interface PersonaSupplementalGuardrailDecisionV1 {
  gate_id: 'identity-write-success' | 'visible-render-cost'
  source: 'runtime-identity-delta' | 'baseline-current-gate'
  status: PersonaGateStatus
  actual: string | null
  sample_size: number
  note?: string
}

export interface PersonaBlindReviewSampleResultV1 {
  sample_id: string
  slice_id: PersonaRolloutSliceId
  required: boolean
  review_target: string
  scores: Record<PersonaBlindReviewDimensionId, number | null>
  notes: string
}

export interface PersonaBlindReviewTemplateV1 {
  version: 'persona-blind-review-template-v1'
  generated_at: string
  mode: PersonaBlindReviewMode
  manifest_run_id: string
  required_slices: typeof PERSONA_T070_REQUIRED_SLICES
  samples: PersonaBlindReviewSampleResultV1[]
}

export interface PersonaBlindReviewResultV1 {
  version: 'persona-blind-review-result-v1'
  generated_at: string
  mode: PersonaBlindReviewMode
  manifest_run_id: string
  samples: PersonaBlindReviewSampleResultV1[]
}

export interface PersonaRolloutIssueV1 {
  code: string
  severity: 'blocking' | 'warning'
  message: string
}

export interface PersonaRolloutCallsiteDeltaV1 {
  source_callsite_id: string
  blocking: boolean
  before_total: number
  after_total: number
  delta: number
  shadow_window_total?: number
  status: 'pass' | 'fail' | 'info'
}

export interface PersonaRolloutSliceSummaryV1 {
  slice_id: PersonaRolloutSliceId
  required: boolean
  available_samples: number
  reviewed_samples: number
  completed: boolean
  average_scores: Record<PersonaBlindReviewDimensionId, number | null>
  status: PersonaGateStatus
}

export interface PersonaRolloutPreReviewSnapshotV1 {
  version: 'persona-rollout-pre-review-v1'
  generated_at: string
  manifest_run_id: string
  overall_status: PersonaGateStatus
  recommendation: Exclude<PersonaRolloutRecommendation, 'go'>
  shadow_activity: {
    window_started_at: string | null
    target_agent_id: string | null
    target_agent_run_count: number
    target_agent_observed_run_count: number
    target_agent_window_callsite_counts: Partial<Record<PersonaRolloutCallsiteId, number>>
    observed_runs_total: number
  }
  offline_gate: {
    snapshot: PersonaGateSnapshotV1
    blocking_gate_status: PersonaGateStatus
    warning_results: PersonaGateResultV1[]
  }
  supplemental_guardrails: PersonaSupplementalGuardrailDecisionV1[]
  callsite_deltas: PersonaRolloutCallsiteDeltaV1[]
  slice_summaries: PersonaRolloutSliceSummaryV1[]
  issues: PersonaRolloutIssueV1[]
}

export interface PersonaRolloutGateSnapshotV1 {
  version: 'persona-rollout-gate-v1'
  generated_at: string
  manifest_run_id: string
  review_mode: PersonaBlindReviewMode
  overall_status: PersonaGateStatus
  recommendation: PersonaRolloutRecommendation
  pre_review_status: PersonaGateStatus
  offline_gate_status: PersonaGateStatus
  callsite_deltas: PersonaRolloutCallsiteDeltaV1[]
  slice_summaries: PersonaRolloutSliceSummaryV1[]
  issues: PersonaRolloutIssueV1[]
}

interface BuildPreReviewInput {
  offlineGate: PersonaGateSnapshotV1
  baselineAttribution?: Partial<PersonaEvalAttributionSummaryV1> | null
  currentAttribution?: Partial<PersonaEvalAttributionSummaryV1> | null
  runtimeIdentityDelta?: PersonaRuntimeIdentityDeltaV1 | null
  baselineGate?: PersonaGateSnapshotV1 | null
  currentGate?: PersonaGateSnapshotV1 | null
  manifest: PersonaEvalCorpusManifestV1
  shadowActivity?: {
    windowStartedAt?: string | null
    targetAgentId: string | null
    targetAgentRunCount: number
    targetAgentObservedRunCount: number
    windowCallsiteCounts?: Partial<Record<PersonaRolloutCallsiteId, number>>
  }
}

interface FinalizeRolloutGateInput {
  preReview: PersonaRolloutPreReviewSnapshotV1
  review: PersonaBlindReviewResultV1
  manifest: PersonaEvalCorpusManifestV1
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value: number | null): number | null {
  if (value === null) return null
  return Math.round(value * 100) / 100
}

function isRequiredSlice(sliceId: PersonaRolloutSliceId): boolean {
  return (PERSONA_T070_REQUIRED_SLICES as readonly string[]).includes(sliceId)
}

function zeroScoreCard(): Record<PersonaBlindReviewDimensionId, number | null> {
  return {
    persona_consistency: null,
    group_distinctiveness: null,
    overlay_naturalness: null,
    nurture_perceptibility: null,
  }
}

function assertValidScore(value: number | null, label: string): void {
  if (value === null) return
  if (!Number.isFinite(value) || value < 0 || value > 5) {
    throw new Error(`${label} must be a number between 0 and 5`)
  }
}

function parseAverageTokens(actual: string | null): number | null {
  if (!actual) return null
  const match = actual.match(/avg=([0-9]+(?:\.[0-9]+)?)\s+tokens/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function formatRatio(value: number | null): string {
  if (value === null) return 'n/a'
  return `${(value * 100).toFixed(1)}%`
}

function activeKeySet(source?: Record<string, number> | null): string[] {
  return Object.entries(source ?? {})
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([key]) => key)
    .sort()
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function sumNewCallsiteRuns(
  baselineCallsites: Record<string, number>,
  currentCallsites: Record<string, number>,
): number {
  return Object.entries(currentCallsites).reduce((sum, [callsite, count]) => {
    if (!Number.isFinite(count) || count <= 0) return sum
    const baselineTotal = baselineCallsites[callsite] ?? 0
    return baselineTotal > 0 ? sum : sum + count
  }, 0)
}

function resolveRuntimeIdentitySupplemental(
  input: PersonaRuntimeIdentityDeltaV1 | null | undefined,
): PersonaSupplementalGuardrailDecisionV1 | null {
  if (!input) return null

  const successDelta = Math.max(0, input.after_success_total - input.before_success_total)
  const failureDelta = Math.max(0, input.after_failure_total - input.before_failure_total)
  const sampleSize = successDelta + failureDelta
  const successRate = sampleSize > 0 ? successDelta / sampleSize : null

  return {
    gate_id: 'identity-write-success',
    source: 'runtime-identity-delta',
    status: sampleSize === 0
      ? 'not_run'
      : successRate !== null && successRate >= 0.95
        ? 'pass'
        : 'fail',
    actual: sampleSize === 0
      ? null
      : `${successDelta}/${sampleSize} successful (${formatRatio(successRate)})`,
    sample_size: sampleSize,
    ...(sampleSize === 0
      ? { note: 'No identity-write attempts were observed between runtime feature snapshots.' }
      : {}),
  }
}

function resolveVisibleRenderCostSupplemental(input: {
  baselineAttribution?: Partial<PersonaEvalAttributionSummaryV1> | null
  currentAttribution?: Partial<PersonaEvalAttributionSummaryV1> | null
  baselineGate?: PersonaGateSnapshotV1 | null
  currentGate?: PersonaGateSnapshotV1 | null
}): PersonaSupplementalGuardrailDecisionV1 | null {
  const baselineResult = input.baselineGate?.results.find((result) => result.gate_id === 'visible-render-cost')
  const currentResult = input.currentGate?.results.find((result) => result.gate_id === 'visible-render-cost')
  if (!baselineResult || !currentResult) return null

  const baselineAverage = parseAverageTokens(baselineResult.actual)
  const currentAverage = parseAverageTokens(currentResult.actual)
  const baselineProviders = activeKeySet(input.baselineAttribution?.by_provider)
  const currentProviders = activeKeySet(input.currentAttribution?.by_provider)
  const baselineModels = activeKeySet(input.baselineAttribution?.by_model)
  const currentModels = activeKeySet(input.currentAttribution?.by_model)
  const providersMatch = sameStringSet(baselineProviders, currentProviders)
  const modelsMatch = sameStringSet(baselineModels, currentModels)
  const baselineCallsites = input.baselineAttribution?.by_callsite ?? {}
  const currentCallsites = input.currentAttribution?.by_callsite ?? {}
  const currentVisibleRuns = input.currentAttribution?.visible_runs_total ?? 0
  const newCallsiteRuns = sumNewCallsiteRuns(baselineCallsites, currentCallsites)
  const newCallsiteShare = currentVisibleRuns > 0 ? newCallsiteRuns / currentVisibleRuns : null
  const comparable = (
    baselineAverage !== null &&
    currentAverage !== null &&
    providersMatch &&
    modelsMatch &&
    newCallsiteShare !== null &&
    newCallsiteShare <= 0.1
  )

  if (!comparable) {
    return {
      gate_id: 'visible-render-cost',
      source: 'baseline-current-gate',
      status: 'not_run',
      actual: currentResult.actual,
      sample_size: currentVisibleRuns,
      note: [
        'Visible render cost baseline remains incomparable.',
        `providers_match=${providersMatch}`,
        `models_match=${modelsMatch}`,
        `new_callsite_share=${formatRatio(newCallsiteShare)}`,
      ].join(' '),
    }
  }

  const threshold = baselineAverage * 1.25
  const deltaRatio = baselineAverage > 0
    ? (currentAverage - baselineAverage) / baselineAverage
    : null

  return {
    gate_id: 'visible-render-cost',
    source: 'baseline-current-gate',
    status: currentAverage <= threshold ? 'pass' : 'fail',
    actual: `baseline=${baselineAverage.toFixed(1)} tokens, current=${currentAverage.toFixed(1)} tokens, delta=${formatRatio(deltaRatio)}`,
    sample_size: currentVisibleRuns,
    ...(currentAverage > threshold
      ? { note: 'Current visible render cost exceeds baseline +25%.' }
      : {}),
  }
}

function mergeSupplementalGuardrail(
  result: PersonaGateResultV1,
  decision: PersonaSupplementalGuardrailDecisionV1 | undefined,
): PersonaGateResultV1 {
  if (!decision) return result
  return {
    gate_id: result.gate_id,
    kind: result.kind,
    threshold: result.threshold,
    status: decision.status,
    actual: decision.actual,
    ...(decision.note ? { note: decision.note } : {}),
  }
}

function validateReviewResult(result: PersonaBlindReviewResultV1, manifestRunId: string): void {
  if (result.version !== 'persona-blind-review-result-v1') {
    throw new Error(`Unsupported review result version: ${result.version}`)
  }
  if (result.manifest_run_id !== manifestRunId) {
    throw new Error(
      `Review manifest_run_id mismatch: expected ${manifestRunId}, received ${result.manifest_run_id}`,
    )
  }

  const seenSampleIds = new Set<string>()
  for (const sample of result.samples) {
    if (seenSampleIds.has(sample.sample_id)) {
      throw new Error(`Duplicate review sample_id: ${sample.sample_id}`)
    }
    seenSampleIds.add(sample.sample_id)
    for (const dimension of PERSONA_T070_REVIEW_DIMENSIONS) {
      assertValidScore(sample.scores[dimension], `${sample.sample_id}.${dimension}`)
    }
  }
}

function createSliceSummaryBase(
  manifest: PersonaEvalCorpusManifestV1,
): Map<PersonaRolloutSliceId, PersonaRolloutSliceSummaryV1> {
  const summaries = new Map<PersonaRolloutSliceId, PersonaRolloutSliceSummaryV1>()
  for (const sliceId of [...PERSONA_T070_REQUIRED_SLICES, ...PERSONA_T070_OPTIONAL_SLICES]) {
    const slice = manifest.slices.find((item) => item.slice_id === sliceId)
    summaries.set(sliceId, {
      slice_id: sliceId,
      required: isRequiredSlice(sliceId),
      available_samples: slice?.samples.length ?? 0,
      reviewed_samples: 0,
      completed: false,
      average_scores: zeroScoreCard(),
      status: slice?.samples.length ? 'warn' : 'not_run',
    })
  }
  return summaries
}

export function buildPersonaBlindReviewTemplate(
  manifest: PersonaEvalCorpusManifestV1,
  mode: PersonaBlindReviewMode = 'collaborative',
): PersonaBlindReviewTemplateV1 {
  return {
    version: 'persona-blind-review-template-v1',
    generated_at: new Date().toISOString(),
    mode,
    manifest_run_id: manifest.run_id,
    required_slices: PERSONA_T070_REQUIRED_SLICES,
    samples: manifest.slices.flatMap((slice) =>
      slice.samples.map((sample) => ({
        sample_id: sample.sample_id,
        slice_id: slice.slice_id,
        required: isRequiredSlice(slice.slice_id),
        review_target: sample.review_target,
        scores: zeroScoreCard(),
        notes: '',
      })),
    ),
  }
}

export function createPersonaBlindReviewResult(
  template: PersonaBlindReviewTemplateV1,
): PersonaBlindReviewResultV1 {
  return {
    version: 'persona-blind-review-result-v1',
    generated_at: new Date().toISOString(),
    mode: template.mode,
    manifest_run_id: template.manifest_run_id,
    samples: template.samples.map((sample) => ({
      ...sample,
      scores: { ...sample.scores },
      notes: sample.notes,
    })),
  }
}

export function buildPersonaRolloutPreReview(
  input: BuildPreReviewInput,
): PersonaRolloutPreReviewSnapshotV1 {
  const baselineCallsites = input.baselineAttribution?.by_callsite ?? {}
  const currentCallsites = input.currentAttribution?.by_callsite ?? {}
  const observedRunsTotal = input.currentAttribution?.observed_runs_total ?? 0
  const targetAgentRunCount = input.shadowActivity?.targetAgentRunCount ?? 0
  const targetAgentObservedRunCount = input.shadowActivity?.targetAgentObservedRunCount ?? 0
  const shadowWindowCallsites = input.shadowActivity?.windowCallsiteCounts ?? {}
  const supplementalGuardrails = [
    resolveRuntimeIdentitySupplemental(input.runtimeIdentityDelta),
    resolveVisibleRenderCostSupplemental({
      baselineAttribution: input.baselineAttribution,
      currentAttribution: input.currentAttribution,
      baselineGate: input.baselineGate,
      currentGate: input.currentGate,
    }),
  ].filter((item): item is PersonaSupplementalGuardrailDecisionV1 => item !== null)
  const supplementalByGate = new Map(supplementalGuardrails.map((item) => [item.gate_id, item] as const))
  const warningResults = input.offlineGate.results
    .filter((result) => result.kind === 'guardrail')
    .map((result) => (
      result.gate_id === 'identity-write-success' || result.gate_id === 'visible-render-cost'
        ? mergeSupplementalGuardrail(result, supplementalByGate.get(result.gate_id))
        : result
    ))
  const issues: PersonaRolloutIssueV1[] = []

  const renderLogCompleteness = input.offlineGate.results.find(
    (result) => result.gate_id === 'render-log-completeness',
  )
  let blockingGateStatus: PersonaGateStatus = 'pass'
  if (!renderLogCompleteness || renderLogCompleteness.status === 'fail' || renderLogCompleteness.status === 'not_run') {
    blockingGateStatus = 'fail'
    issues.push({
      code: 'render-log-completeness-failed',
      severity: 'blocking',
      message: renderLogCompleteness?.note
        ?? 'render-log-completeness gate did not pass for visible-complete observations.',
    })
  }

  for (const result of warningResults) {
    if (result.gate_id === 'visible-render-cost' && result.status === 'not_run') {
      issues.push({
        code: 'cost-baseline-incomparable',
        severity: 'warning',
        message: result.note ?? 'Visible render cost baseline is not comparable in offline replay.',
      })
      continue
    }
    if (result.status === 'fail') {
      issues.push({
        code: `${result.gate_id}-guardrail-failed`,
        severity: 'warning',
        message: `${result.gate_id} guardrail failed (${result.actual ?? 'n/a'}).`,
      })
    } else if (result.status === 'not_run') {
      issues.push({
        code: `${result.gate_id}-guardrail-not-run`,
        severity: 'warning',
        message: `${result.gate_id} guardrail did not run.`,
      })
    }
  }

  const callsiteDeltas: PersonaRolloutCallsiteDeltaV1[] = [
    ...PERSONA_T070_BLOCKING_CALLSITES.map((callsite) => {
      const beforeTotal = baselineCallsites[callsite] ?? 0
      const afterTotal = currentCallsites[callsite] ?? 0
      const shadowWindowTotal = shadowWindowCallsites[callsite] ?? 0
      const delta = afterTotal - beforeTotal
      const advanced = shadowWindowTotal > 0 || delta > 0
      const status: PersonaRolloutCallsiteDeltaV1['status'] = advanced ? 'pass' : 'fail'
      if (!advanced) {
        issues.push({
          code: `callsite-${callsite}-not-advanced`,
          severity: 'blocking',
          message: `${callsite} did not produce observed shadow-window runs and did not advance in corpus totals during T-070 shadow logging.`,
        })
      }
      return {
        source_callsite_id: callsite,
        blocking: true,
        before_total: beforeTotal,
        after_total: afterTotal,
        delta,
        shadow_window_total: shadowWindowTotal,
        status,
      }
    }),
    ...PERSONA_T070_OPPORTUNISTIC_CALLSITES.map((callsite) => {
      const beforeTotal = baselineCallsites[callsite] ?? 0
      const afterTotal = currentCallsites[callsite] ?? 0
      const shadowWindowTotal = shadowWindowCallsites[callsite] ?? 0
      const item: PersonaRolloutCallsiteDeltaV1 = {
        source_callsite_id: callsite,
        blocking: false,
        before_total: beforeTotal,
        after_total: afterTotal,
        delta: afterTotal - beforeTotal,
        shadow_window_total: shadowWindowTotal,
        status: 'info',
      }
      return item
    }),
  ]

  const sliceSummaries = Array.from(createSliceSummaryBase(input.manifest).values()).map((summary) => {
    if (summary.required && summary.available_samples === 0) {
      issues.push({
        code: `slice-${summary.slice_id}-missing`,
        severity: 'warning',
        message: `${summary.slice_id} has no eligible samples in the current corpus.`,
      })
    }
    return summary
  })

  if (targetAgentRunCount > 0 && targetAgentObservedRunCount === 0) {
    issues.push({
      code: 'shadow-runs-missing-persona-observation',
      severity: 'blocking',
      message: 'Shadow run window produced target agent runs, but none in that window carried persona_observation.',
    })
  }

  const hasBlockingIssue = issues.some((issue) => issue.severity === 'blocking')
  const hasWarningIssue = issues.some((issue) => issue.severity === 'warning')
  const overallStatus: PersonaGateStatus = hasBlockingIssue ? 'fail' : hasWarningIssue ? 'warn' : 'pass'

  return {
    version: 'persona-rollout-pre-review-v1',
    generated_at: new Date().toISOString(),
    manifest_run_id: input.manifest.run_id,
    overall_status: overallStatus,
    recommendation: overallStatus === 'fail' ? 'rollback' : 'hold',
    shadow_activity: {
      window_started_at: input.shadowActivity?.windowStartedAt ?? null,
      target_agent_id: input.shadowActivity?.targetAgentId ?? null,
      target_agent_run_count: targetAgentRunCount,
      target_agent_observed_run_count: targetAgentObservedRunCount,
      target_agent_window_callsite_counts: shadowWindowCallsites,
      observed_runs_total: observedRunsTotal,
    },
    offline_gate: {
      snapshot: input.offlineGate,
      blocking_gate_status: blockingGateStatus,
      warning_results: warningResults,
    },
    supplemental_guardrails: supplementalGuardrails,
    callsite_deltas: callsiteDeltas,
    slice_summaries: sliceSummaries,
    issues,
  }
}

function summarizeBlindReview(
  manifest: PersonaEvalCorpusManifestV1,
  review: PersonaBlindReviewResultV1,
): PersonaRolloutSliceSummaryV1[] {
  const summaries = createSliceSummaryBase(manifest)
  const sampleIndex = new Map<string, PersonaRolloutSliceId>()
  const reviewBySampleId = new Map<string, PersonaBlindReviewSampleResultV1>()

  for (const slice of manifest.slices) {
    for (const sample of slice.samples) {
      sampleIndex.set(sample.sample_id, slice.slice_id)
    }
  }

  for (const sample of review.samples) {
    const sliceId = sampleIndex.get(sample.sample_id)
    if (!sliceId) {
      throw new Error(`Unknown review sample_id: ${sample.sample_id}`)
    }
    if (sample.slice_id !== sliceId) {
      throw new Error(`slice_id mismatch for sample ${sample.sample_id}: expected ${sliceId}, received ${sample.slice_id}`)
    }
    reviewBySampleId.set(sample.sample_id, sample)
  }

  for (const [sliceId, summary] of summaries.entries()) {
    const scoresByDimension = Object.fromEntries(
      PERSONA_T070_REVIEW_DIMENSIONS.map((dimension) => [dimension, [] as number[]]),
    ) as Record<PersonaBlindReviewDimensionId, number[]>

    const slice = manifest.slices.find((item) => item.slice_id === sliceId)
    const samples = (slice?.samples ?? [])
      .map((item) => reviewBySampleId.get(item.sample_id))
      .filter((item): item is PersonaBlindReviewSampleResultV1 => item != null)

    summary.reviewed_samples = samples.filter((sample) =>
      PERSONA_T070_REVIEW_DIMENSIONS.every((dimension) => sample.scores[dimension] !== null),
    ).length
    summary.completed = summary.available_samples > 0 && summary.reviewed_samples === summary.available_samples

    for (const sample of samples) {
      for (const dimension of PERSONA_T070_REVIEW_DIMENSIONS) {
        const score = sample.scores[dimension]
        if (score !== null) {
          scoresByDimension[dimension].push(score)
        }
      }
    }

    for (const dimension of PERSONA_T070_REVIEW_DIMENSIONS) {
      summary.average_scores[dimension] = round(mean(scoresByDimension[dimension]))
    }

    if (summary.available_samples === 0) {
      summary.status = 'warn'
      continue
    }

    const hasLowAverage = PERSONA_T070_REVIEW_DIMENSIONS.some((dimension) => {
      const value = summary.average_scores[dimension]
      return value !== null && value < 3
    })
    if (hasLowAverage) {
      summary.status = 'fail'
      continue
    }
    if (!summary.completed) {
      summary.status = 'warn'
      continue
    }
    summary.status = 'pass'
  }

  return Array.from(summaries.values())
}

export function finalizePersonaRolloutGate(
  input: FinalizeRolloutGateInput,
): PersonaRolloutGateSnapshotV1 {
  validateReviewResult(input.review, input.manifest.run_id)

  const issues = [...input.preReview.issues]
  const sliceSummaries = summarizeBlindReview(input.manifest, input.review)

  for (const summary of sliceSummaries) {
    if (!summary.required) continue
    if (summary.available_samples === 0) {
      issues.push({
        code: `slice-${summary.slice_id}-missing`,
        severity: 'warning',
        message: `${summary.slice_id} still has no eligible samples.`,
      })
      continue
    }
    if (!summary.completed) {
      issues.push({
        code: `slice-${summary.slice_id}-incomplete-review`,
        severity: 'warning',
        message: `${summary.slice_id} blind review is incomplete.`,
      })
      continue
    }
    if (summary.status === 'fail') {
      issues.push({
        code: `slice-${summary.slice_id}-avg-below-threshold`,
        severity: 'blocking',
        message: `${summary.slice_id} has at least one average review score below 3.`,
      })
    }
  }
  const uniqueIssues = dedupeIssues(issues)
  const hasBlockingIssue = uniqueIssues.some((issue) => issue.severity === 'blocking')
  const hasWarningIssue = uniqueIssues.some((issue) => issue.severity === 'warning')

  const overallStatus: PersonaGateStatus = hasBlockingIssue ? 'fail' : hasWarningIssue ? 'warn' : 'pass'
  const recommendation = deriveRecommendation(overallStatus, uniqueIssues, sliceSummaries)

  return {
    version: 'persona-rollout-gate-v1',
    generated_at: new Date().toISOString(),
    manifest_run_id: input.manifest.run_id,
    review_mode: input.review.mode,
    overall_status: overallStatus,
    recommendation,
    pre_review_status: input.preReview.overall_status,
    offline_gate_status: input.preReview.offline_gate.blocking_gate_status,
    callsite_deltas: input.preReview.callsite_deltas,
    slice_summaries: sliceSummaries,
    issues: uniqueIssues,
  }
}

function dedupeIssues(issues: PersonaRolloutIssueV1[]): PersonaRolloutIssueV1[] {
  const seen = new Set<string>()
  const out: PersonaRolloutIssueV1[] = []
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.code}:${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(issue)
  }
  return out
}

function deriveRecommendation(
  overallStatus: PersonaGateStatus,
  issues: PersonaRolloutIssueV1[],
  sliceSummaries: PersonaRolloutSliceSummaryV1[],
): PersonaRolloutRecommendation {
  if (overallStatus === 'pass') return 'go'
  if (overallStatus === 'fail') return 'rollback'

  const requiredSlicesHealthy = sliceSummaries
    .filter((summary) => summary.required)
    .every((summary) => {
      if (summary.slice_id === 'fallback_or_degraded' && summary.available_samples === 0) {
        return true
      }
      return summary.available_samples > 0 && summary.completed && summary.status === 'pass'
    })

  const allowedCaveatCodes = new Set([
    'cost-baseline-incomparable',
    'slice-fallback_or_degraded-missing',
    'slice-same-seed-cross-line-missing',
  ])

  const onlySoftWarnings = issues.every((issue) => issue.severity !== 'blocking' && allowedCaveatCodes.has(issue.code))
  if (requiredSlicesHealthy && onlySoftWarnings) {
    return 'go_with_caveats'
  }

  return 'hold'
}

export function renderPersonaRolloutVerdictMarkdown(
  snapshot: PersonaRolloutGateSnapshotV1,
): string {
  const lines = [
    '# T-070 Rollout Verdict',
    '',
    `- generated_at: ${snapshot.generated_at}`,
    `- manifest_run_id: ${snapshot.manifest_run_id}`,
    `- review_mode: ${snapshot.review_mode}`,
    `- overall_status: ${snapshot.overall_status}`,
    `- recommendation: ${snapshot.recommendation}`,
    '',
    '## Slice Summary',
    '',
    '| slice_id | required | available | reviewed | completed | status |',
    '| --- | --- | ---: | ---: | --- | --- |',
    ...snapshot.slice_summaries.map((summary) =>
      `| ${summary.slice_id} | ${summary.required ? 'yes' : 'no'} | ${summary.available_samples} | ${summary.reviewed_samples} | ${summary.completed ? 'yes' : 'no'} | ${summary.status} |`,
    ),
    '',
    '## Callsite Coverage',
    '',
    '| callsite | blocking | before | after | delta | shadow_window | status |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...snapshot.callsite_deltas.map((item) =>
      `| ${item.source_callsite_id} | ${item.blocking ? 'yes' : 'no'} | ${item.before_total} | ${item.after_total} | ${item.delta} | ${item.shadow_window_total ?? 0} | ${item.status} |`,
    ),
    '',
    '## Issues',
    '',
  ]

  if (snapshot.issues.length === 0) {
    lines.push('- none')
  } else {
    lines.push(...snapshot.issues.map((issue) => `- [${issue.severity}] ${issue.code}: ${issue.message}`))
  }

  return `${lines.join('\n')}\n`
}
