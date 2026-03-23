import type { MediaAuditContext, MediaAuditDecision } from '../repos/types.js'
import { MEDIA_SEMANTIC_SCHEMA_VERSION } from './media-contract-utils.js'

export interface MediaAuditEnforcement {
  strict_audit_enforced?: boolean
  lineage_required?: boolean
  semantic_v3_enforced?: boolean
}

export interface EvaluateMediaAuditInput {
  text: string
  audit_context?: MediaAuditContext | null
  lineage_complete?: boolean
  source_explainable?: boolean
  policy_match?: boolean
  asset_id?: string | null
  summary_schema_version?: string | null
  enforcement?: MediaAuditEnforcement | null
}

export interface EvaluatedMediaAudit {
  text: string
  decision: MediaAuditDecision
}

function isStrictAuditEnforced(input: EvaluateMediaAuditInput): boolean {
  return input.enforcement?.strict_audit_enforced ?? true
}

function isLineageRequired(input: EvaluateMediaAuditInput): boolean {
  return input.enforcement?.lineage_required ?? true
}

function isSemanticV3Enforced(input: EvaluateMediaAuditInput): boolean {
  return input.enforcement?.semantic_v3_enforced ?? true
}

function redactText(text: string, terms: string[]): { text: string; redacted_terms: string[] } {
  let next = text
  const redactedTerms: string[] = []
  for (const term of terms) {
    if (!term.trim()) continue
    if (!next.includes(term)) continue
    next = next.split(term).join('[redacted]')
    redactedTerms.push(term)
  }
  return {
    text: next,
    redacted_terms: redactedTerms,
  }
}

export function evaluateMediaAudit(input: EvaluateMediaAuditInput): EvaluatedMediaAudit {
  const auditContext = input.audit_context ?? undefined
  if (
    isSemanticV3Enforced(input)
    && input.summary_schema_version
    && input.summary_schema_version !== MEDIA_SEMANTIC_SCHEMA_VERSION
  ) {
    return {
      text: '',
      decision: {
        decision: 'block',
        reason_codes: ['semantic_schema_not_v3'],
        redacted_terms: [],
      },
    }
  }
  if (!input.audit_context && isStrictAuditEnforced(input)) {
    return {
      text: '',
      decision: {
        decision: 'block',
        reason_codes: ['missing_audit_context'],
        redacted_terms: [],
      },
    }
  }
  if (input.lineage_complete === false && isLineageRequired(input)) {
    return {
      text: '',
      decision: {
        decision: 'block',
        reason_codes: ['lineage_incomplete'],
        redacted_terms: [],
      },
    }
  }
  if (input.source_explainable === false && isStrictAuditEnforced(input)) {
    return {
      text: '',
      decision: {
        decision: 'block',
        reason_codes: ['source_unexplainable'],
        redacted_terms: [],
      },
    }
  }
  if (input.policy_match === false && isStrictAuditEnforced(input)) {
    return {
      text: '',
      decision: {
        decision: 'block',
        reason_codes: ['policy_not_matched'],
        redacted_terms: [],
      },
    }
  }

  const sensitiveTerms = [
    ...(auditContext?.sensitive_terms ?? []),
    ...(input.asset_id ? [input.asset_id] : []),
  ]
  const { text, redacted_terms } = redactText(input.text, sensitiveTerms)
  if (redacted_terms.length > 0) {
    return {
      text,
      decision: {
        decision: 'redact',
        reason_codes: ['sensitive_terms_redacted'],
        redacted_terms,
      },
    }
  }

  return {
    text: input.text,
    decision: {
      decision: 'allow',
      reason_codes: ['audit_passed'],
      redacted_terms: [],
    },
  }
}
