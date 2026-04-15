import type {
  WarmupVerifierDiagnosis,
  WarmupVerifierPhase,
  WarmupVerifierSubsystem,
} from '../../shared/warmup-verifier.js'
import type { WarmupReviewReasonCode } from '../repos/types/warmup-governance.js'

type DiagnosisTemplate = Omit<WarmupVerifierDiagnosis, 'evidence_refs' | 'raw_reason'>

const baselineReasonMap: Record<string, DiagnosisTemplate> = {
  no_active_baseline: {
    phase: 'baseline_admission',
    subsystem: 'warmup_governance',
    code: 'baseline.missing_active_baseline',
    severity: 'error',
    summary_zh: '当前没有生效中的 warm-up baseline，runtime 放量无法验证。',
    recommended_next_check: '检查 active baseline 是否被 archive，或 suite activation 是否未完成。',
  },
  kickoff_layer_not_ready: {
    phase: 'baseline_admission',
    subsystem: 'warmup_governance',
    code: 'baseline.kickoff_layer_not_ready',
    severity: 'error',
    summary_zh: '当前 active baseline 的 kickoff 层未就绪。',
    recommended_next_check: '检查 kickoff batch state、activation 时间戳和 suite 切换记录。',
  },
  warmup_layer_not_ready: {
    phase: 'baseline_admission',
    subsystem: 'warmup_governance',
    code: 'baseline.warmup_layer_not_ready',
    severity: 'error',
    summary_zh: '当前 active baseline 的 warm-up 层未就绪。',
    recommended_next_check: '检查 warmup batch state、runtime top-up 和 active baseline 关联是否一致。',
  },
  review_not_fresh_or_not_passed: {
    phase: 'baseline_admission',
    subsystem: 'warmup_governance',
    code: 'baseline.review_state_invalid',
    severity: 'error',
    summary_zh: '当前 suite 的 review 不是最新通过状态，baseline 准入被阻断。',
    recommended_next_check: '检查 latest review、batch revision 和 activation 前后的 freshness 判定。',
  },
  key_communities_not_ready: {
    phase: 'baseline_admission',
    subsystem: 'home_programming',
    code: 'baseline.community_supply_not_ready',
    severity: 'error',
    summary_zh: '关键社区供给未达到 warm-up 准入要求。',
    recommended_next_check: '检查 community supply floor、社区内容覆盖以及对应 launch schedule 映射。',
  },
  key_shelves_not_ready: {
    phase: 'baseline_admission',
    subsystem: 'home_programming',
    code: 'baseline.shelf_programming_not_ready',
    severity: 'error',
    summary_zh: '关键 shelf 编排未达到 warm-up 准入要求。',
    recommended_next_check: '检查 home/daypart 编排、required outcomes 和投影结果是否对齐。',
  },
  media_access_not_ready: {
    phase: 'baseline_admission',
    subsystem: 'media_pipeline',
    code: 'baseline.media_pipeline_not_ready',
    severity: 'error',
    summary_zh: '媒体访问或视觉覆盖未达到 warm-up 准入要求。',
    recommended_next_check: '检查 visual ratio、媒体 attach 和 rollout gate 状态。',
  },
  aftershow_pipeline_not_ready: {
    phase: 'baseline_admission',
    subsystem: 'aftershow',
    code: 'baseline.aftershow_not_ready',
    severity: 'error',
    summary_zh: 'aftershow 链路未达到 warm-up 准入要求。',
    recommended_next_check: '检查 aftershow artifact 生成、导出开关和对应社区策略。',
  },
}

const reviewReasonMap: Record<WarmupReviewReasonCode, DiagnosisTemplate> = {
  content_quality: {
    phase: 'activation_precheck',
    subsystem: 'warmup_governance',
    code: 'review.content_quality_failed',
    severity: 'error',
    summary_zh: 'review 认为当前 suite 内容质量不足，未满足激活门槛。',
    recommended_next_check: '检查 suite 样本内容、localized edit 记录以及 review note。',
  },
  distribution_density: {
    phase: 'activation_precheck',
    subsystem: 'warmup_governance',
    code: 'review.distribution_density_failed',
    severity: 'error',
    summary_zh: 'review 认为当前 suite 的分布密度或互动密度不足。',
    recommended_next_check: '检查 posts/threads/turns/votes 统计与关键社区分布。',
  },
  media_coverage: {
    phase: 'activation_precheck',
    subsystem: 'media_pipeline',
    code: 'review.media_coverage_failed',
    severity: 'error',
    summary_zh: 'review 认为当前 suite 的媒体覆盖不足。',
    recommended_next_check: '检查媒体挂载、coverage ratio 与 highlight packaging。',
  },
  kickoff_invalid: {
    phase: 'activation_precheck',
    subsystem: 'warmup_governance',
    code: 'review.kickoff_invalid',
    severity: 'error',
    summary_zh: 'review 认为 kickoff 层内容不再有效，导致 suite 无法继续激活。',
    recommended_next_check: '检查 kickoff batch 的 revision、局部修补和恢复记录。',
  },
  process_issue: {
    phase: 'activation_precheck',
    subsystem: 'warmup_governance',
    code: 'review.process_issue',
    severity: 'error',
    summary_zh: 'review 发现了流程性问题，当前 suite 暂不允许激活。',
    recommended_next_check: '检查 suite review、rebuild、retry 与 activation 操作链是否完整。',
  },
}

function mapBatchFloorReason(reason: string): DiagnosisTemplate | null {
  const match = reason.match(/^(kickoff|warmup|suite)_(posts|threads|turns|votes|media|communities|media_ratio)_(below_floor|above_ceiling)$/)
  if (!match) return null

  const [, layer, metric, condition] = match
  const codeMetric = metric === 'media_ratio' ? 'media_ratio' : metric
  return {
    phase: 'activation_precheck',
    subsystem: metric === 'media' || metric === 'media_ratio' ? 'media_pipeline' : 'warmup_governance',
    code: `activation.${layer}_${codeMetric}_${condition}`,
    severity: 'error',
    summary_zh:
      layer === 'suite'
        ? `suite 的 ${metric} 指标未满足激活要求。`
        : `${layer} 层的 ${metric} 指标未满足激活要求。`,
    recommended_next_check:
      metric === 'media' || metric === 'media_ratio'
        ? '检查媒体附着、coverage ratio 和 visual rollout 配置。'
        : '检查 batch 统计、内容生成数量和覆盖分布是否达到 floor。',
  }
}

function withEvidence(
  template: DiagnosisTemplate,
  input: {
    artifact: string
    pointer?: string | null
    raw_reason?: string | null
  },
): WarmupVerifierDiagnosis {
  return {
    ...template,
    evidence_refs: [{
      artifact: input.artifact,
      pointer: input.pointer ?? null,
      note: input.raw_reason ?? null,
    }],
    raw_reason: input.raw_reason ?? null,
  }
}

export function mapActivationReasonToDiagnosis(
  reason: string,
  pointer?: string,
): WarmupVerifierDiagnosis {
  const template = mapBatchFloorReason(reason) ?? baselineReasonMap[reason] ?? {
    phase: 'activation_precheck' as WarmupVerifierPhase,
    subsystem: 'warmup_governance' as WarmupVerifierSubsystem,
    code: `activation.${reason}`,
    severity: 'error' as const,
    summary_zh: `activation precheck 被原因 ${reason} 阻断。`,
    recommended_next_check: '检查 suite detail.activation_readiness.reasons 和对应 batch 统计。',
  }
  return withEvidence(template, {
    artifact: 'suite-snapshot-before.json',
    pointer,
    raw_reason: reason,
  })
}

export function mapBaselineReasonToDiagnosis(
  reason: string,
  pointer?: string,
): WarmupVerifierDiagnosis {
  const template = baselineReasonMap[reason] ?? {
    phase: 'baseline_admission' as WarmupVerifierPhase,
    subsystem: 'warmup_governance' as WarmupVerifierSubsystem,
    code: `baseline.${reason}`,
    severity: 'error' as const,
    summary_zh: `baseline admission 被原因 ${reason} 阻断。`,
    recommended_next_check: '检查 baseline admission reasons 与 runtime readiness 汇总。',
  }
  return withEvidence(template, {
    artifact: 'baseline-admission-before.json',
    pointer,
    raw_reason: reason,
  })
}

export function mapReviewReasonToDiagnosis(
  reason: WarmupReviewReasonCode,
  pointer?: string,
): WarmupVerifierDiagnosis {
  return withEvidence(reviewReasonMap[reason], {
    artifact: 'suite-snapshot-before.json',
    pointer,
    raw_reason: reason,
  })
}

export function createVerifierDiagnosis(input: {
  phase: WarmupVerifierPhase
  subsystem: WarmupVerifierSubsystem
  code: string
  summary_zh: string
  recommended_next_check: string
  artifact: string
  pointer?: string | null
  severity?: WarmupVerifierDiagnosis['severity']
  raw_reason?: string | null
}): WarmupVerifierDiagnosis {
  return withEvidence({
    phase: input.phase,
    subsystem: input.subsystem,
    code: input.code,
    severity: input.severity ?? 'error',
    summary_zh: input.summary_zh,
    recommended_next_check: input.recommended_next_check,
  }, {
    artifact: input.artifact,
    pointer: input.pointer ?? null,
    raw_reason: input.raw_reason ?? null,
  })
}

export function sortDiagnoses(diagnoses: WarmupVerifierDiagnosis[]): WarmupVerifierDiagnosis[] {
  return [...diagnoses].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === 'error' ? -1 : 1
    }
    return left.code.localeCompare(right.code)
  })
}
