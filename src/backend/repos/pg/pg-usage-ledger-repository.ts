import { Prisma, type PrismaClient } from '@prisma/client'
import type { UsageLedgerEntry } from '../../llm/gateway-contract.js'
import type { UsageLedgerRepository } from '../../llm/usage-ledger.js'

export class PgUsageLedgerRepository implements UsageLedgerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(entry: UsageLedgerEntry): Promise<void> {
    await this.prisma.llmUsageLedger.create({
      data: {
        traceId: entry.trace_id,
        agentId: entry.agent_id,
        intent: entry.intent,
        visibility: entry.visibility,
        scene: entry.scene,
        promptRefId: entry.prompt_ref.id,
        promptRefVersion: entry.prompt_ref.version,
        providerId: entry.provider_id,
        modelId: entry.model_id,
        profileId: entry.profile_id,
        policyId: entry.policy_id,
        adapterId: entry.adapter_id,
        poolId: entry.pool_id,
        credentialId: entry.credential_id,
        routeOrderJson: toNullableJson(entry.route_order),
        orderedCandidatesJson: toNullableJson(entry.ordered_candidates),
        fallbackChainJson: toNullableJson(entry.fallback_chain),
        fallbackHistoryJson: toNullableJson(entry.fallback_history),
        mergeTraceJson: toNullableJson(entry.merge_trace),
        resolvedParamsJson: toNullableJson(entry.resolved_params),
        voiceLineId: entry.render_decision?.voiceLineId,
        tier: entry.render_decision?.tier,
        fallbackLevel: entry.render_decision?.fallbackLevel,
        billingClass: entry.billing_class,
        promptTokens: entry.usage?.prompt_tokens,
        completionTokens: entry.usage?.completion_tokens,
        totalTokens: entry.usage?.total_tokens,
        estimatedCostCny: entry.estimated_cost_cny,
        reservedCostCny: entry.reserved_cost_cny,
        actualCostCny: entry.actual_cost_cny,
        success: entry.success,
        errorCode: entry.error_code,
        latencyMs: entry.latency_ms,
        platformRetryCount: entry.platform_retry_count ?? 0,
      },
    })
  }

  async listRecent(limit = 100): Promise<UsageLedgerEntry[]> {
    const rows = await this.prisma.llmUsageLedger.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toEntry)
  }

  async listByAgent(agentId: string, limit = 100): Promise<UsageLedgerEntry[]> {
    const rows = await this.prisma.llmUsageLedger.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toEntry)
  }

  async listByTracePrefix(tracePrefix: string, limit = 100): Promise<UsageLedgerEntry[]> {
    const rows = await this.prisma.llmUsageLedger.findMany({
      where: {
        traceId: {
          startsWith: tracePrefix,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toEntry)
  }

  async sumCostByAgent(agentId: string, since: Date): Promise<number> {
    const result = await this.prisma.llmUsageLedger.aggregate({
      _sum: { actualCostCny: true },
      where: { agentId, success: true, createdAt: { gte: since } },
    })
    return result._sum.actualCostCny ?? 0
  }

  async sumCostByBillingClass(billingClass: string, since: Date): Promise<number> {
    const result = await this.prisma.llmUsageLedger.aggregate({
      _sum: { actualCostCny: true },
      where: { billingClass, success: true, createdAt: { gte: since } },
    })
    return result._sum.actualCostCny ?? 0
  }
}

function toEntry(row: {
  traceId: string
  agentId: string
  intent: string
  visibility: string
  scene: string
  promptRefId: string
  promptRefVersion: number
  providerId: string | null
  modelId: string | null
  profileId: string | null
  policyId: string | null
  adapterId: string | null
  poolId: string | null
  credentialId: string | null
  routeOrderJson: Prisma.JsonValue | null
  orderedCandidatesJson: Prisma.JsonValue | null
  fallbackChainJson: Prisma.JsonValue | null
  fallbackHistoryJson: Prisma.JsonValue | null
  mergeTraceJson: Prisma.JsonValue | null
  resolvedParamsJson: Prisma.JsonValue | null
  voiceLineId: string | null
  tier: string | null
  fallbackLevel: string | null
  billingClass: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  estimatedCostCny: number | null
  reservedCostCny: number | null
  actualCostCny: number | null
  success: boolean
  errorCode: string | null
  latencyMs: number
  platformRetryCount: number
  createdAt: Date
}): UsageLedgerEntry {
  return {
    trace_id: row.traceId,
    agent_id: row.agentId,
    intent: row.intent as UsageLedgerEntry['intent'],
    visibility: row.visibility as UsageLedgerEntry['visibility'],
    scene: row.scene as UsageLedgerEntry['scene'],
    prompt_ref: { id: row.promptRefId, version: row.promptRefVersion },
    render_decision: {
      voiceLineId: (row.voiceLineId ?? '') as UsageLedgerEntry['render_decision']['voiceLineId'],
      tier: (row.tier ?? 'base') as UsageLedgerEntry['render_decision']['tier'],
      profileId: row.profileId ?? '',
      providerId: row.providerId ?? '',
      modelId: row.modelId ?? '',
      region: '',
      fallbackLevel: (row.fallbackLevel ?? 'none') as UsageLedgerEntry['render_decision']['fallbackLevel'],
      reasons: [],
      promptTemplateId: row.promptRefId,
      promptVersion: row.promptRefVersion,
    },
    usage: row.promptTokens != null
      ? { prompt_tokens: row.promptTokens, completion_tokens: row.completionTokens ?? 0, total_tokens: row.totalTokens ?? 0 }
      : undefined,
    success: row.success,
    provider_id: row.providerId ?? undefined,
    model_id: row.modelId ?? undefined,
    profile_id: row.profileId ?? undefined,
    policy_id: row.policyId ?? undefined,
    adapter_id: row.adapterId ?? undefined,
    pool_id: row.poolId ?? undefined,
    credential_id: row.credentialId ?? undefined,
    route_order: parseJsonArray<UsageLedgerEntry['route_order']>(row.routeOrderJson),
    ordered_candidates: parseJsonArray<UsageLedgerEntry['ordered_candidates']>(row.orderedCandidatesJson),
    fallback_chain: parseJsonArray<UsageLedgerEntry['fallback_chain']>(row.fallbackChainJson),
    fallback_history: parseJsonArray<UsageLedgerEntry['fallback_history']>(row.fallbackHistoryJson),
    merge_trace: parseJsonValue<UsageLedgerEntry['merge_trace']>(row.mergeTraceJson),
    resolved_params: parseJsonValue<UsageLedgerEntry['resolved_params']>(row.resolvedParamsJson),
    billing_class: row.billingClass as UsageLedgerEntry['billing_class'],
    estimated_cost_cny: row.estimatedCostCny ?? undefined,
    reserved_cost_cny: row.reservedCostCny ?? undefined,
    actual_cost_cny: row.actualCostCny ?? undefined,
    platform_retry_count: row.platformRetryCount,
    error_code: row.errorCode as UsageLedgerEntry['error_code'],
    latency_ms: row.latencyMs,
    created_at: row.createdAt.toISOString(),
  }
}

function toNullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value == null) return undefined
  return value as Prisma.InputJsonValue
}

function parseJsonArray<T>(value: Prisma.JsonValue | null): T | undefined {
  if (!Array.isArray(value)) return undefined
  return value as T
}

function parseJsonValue<T>(value: Prisma.JsonValue | null): T | undefined {
  if (value == null) return undefined
  return value as T
}
