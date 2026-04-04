import { describe, expect, it, beforeEach } from 'vitest'
import { InMemoryUsageLedgerRepository } from '../../llm/usage-ledger.js'
import type { UsageLedgerEntry } from '../../llm/gateway-contract.js'
import {
  collectIdentityWriteDelta,
  collectCostBaselineFromLedger,
  collectFallbackOrDegradedEntries,
  startRolloutEvidenceWindow,
  getActiveRolloutWindow,
  clearActiveRolloutWindow,
} from '../rollout-evidence-collector.js'
import { personaObservability } from '../persona-observability.js'

function makeLedgerEntry(overrides: Partial<UsageLedgerEntry> = {}): UsageLedgerEntry {
  return {
    trace_id: 'tr-1',
    agent_id: 'agent-1',
    intent: 'forum_reply',
    visibility: 'visible',
    scene: 'forum_post',
    prompt_ref: { id: 'tpl-1', version: 1 },
    render_decision: {
      voiceLineId: 'qwen-social-v1',
      tier: 'base',
      profileId: 'prof-1',
      providerId: 'dashscope-openai',
      modelId: 'qwen-flash-character',
      region: 'cn-hangzhou',
      fallbackLevel: 'none',
      reasons: ['primary'],
      promptTemplateId: 'tpl-1',
      promptVersion: 1,
    },
    usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
    success: true,
    provider_id: 'dashscope-openai',
    model_id: 'qwen-flash-character',
    policy_id: 'visible-forum_reply-base',
    adapter_id: 'openai-chat-completions-v1',
    credential_id: 'cred-1',
    latency_ms: 1200,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('rollout-evidence-collector', () => {
  beforeEach(() => {
    personaObservability.reset()
    clearActiveRolloutWindow()
  })

  describe('startRolloutEvidenceWindow / getActiveRolloutWindow / clearActiveRolloutWindow', () => {
    it('creates and returns an evidence window', () => {
      expect(getActiveRolloutWindow()).toBeNull()
      const win = startRolloutEvidenceWindow()
      expect(win.startedAt).toBeInstanceOf(Date)
      expect(win.beforeSnapshot.context_memory.identity_writes.success_total).toBe(0)
      expect(getActiveRolloutWindow()).toBe(win)
    })

    it('clears active window', () => {
      startRolloutEvidenceWindow()
      clearActiveRolloutWindow()
      expect(getActiveRolloutWindow()).toBeNull()
    })
  })

  describe('collectIdentityWriteDelta', () => {
    it('returns zero delta when no identity writes occurred', () => {
      const before = personaObservability.snapshot()
      const delta = collectIdentityWriteDelta(before)
      expect(delta.before_success_total).toBe(0)
      expect(delta.before_failure_total).toBe(0)
      expect(delta.after_success_total).toBe(0)
      expect(delta.after_failure_total).toBe(0)
    })

    it('captures identity write successes and failures', () => {
      personaObservability.recordIdentityWrite(true)
      personaObservability.recordIdentityWrite(true)
      const before = personaObservability.snapshot()

      personaObservability.recordIdentityWrite(true)
      personaObservability.recordIdentityWrite(false)

      const delta = collectIdentityWriteDelta(before)
      expect(delta.before_success_total).toBe(2)
      expect(delta.before_failure_total).toBe(0)
      expect(delta.after_success_total).toBe(3)
      expect(delta.after_failure_total).toBe(1)
    })
  })

  describe('collectCostBaselineFromLedger', () => {
    it('returns attribution and gate from ledger entries', async () => {
      const repo = new InMemoryUsageLedgerRepository()
      const now = new Date()
      const since = new Date(now.getTime() - 3600_000)

      await repo.insert(makeLedgerEntry({
        agent_id: 'agent-1',
        created_at: now.toISOString(),
      }))
      await repo.insert(makeLedgerEntry({
        agent_id: 'agent-1',
        visibility: 'hidden',
        provider_id: 'dashscope-openai',
        model_id: 'qwen-flash-character',
        created_at: now.toISOString(),
      }))

      const { attribution, gate } = await collectCostBaselineFromLedger(repo, 'agent-1', since)

      expect(attribution.visible_runs_total).toBe(1)
      expect(attribution.hidden_runs_total).toBe(1)
      expect(attribution.observed_runs_total).toBe(2)
      expect(attribution.by_provider?.['dashscope-openai']).toBe(2)
      expect(attribution.by_policy?.['visible-forum_reply-base']).toBe(2)
      expect(attribution.by_adapter?.['openai-chat-completions-v1']).toBe(2)
      expect(attribution.by_credential?.['cred-1']).toBe(2)
      expect(attribution.by_provider_model?.['dashscope-openai/qwen-flash-character']).toBe(2)
      expect(gate.version).toBe('persona-gate-snapshot-v1')
      expect(gate.results.length).toBe(2)
    })

    it('returns not_run gate when no visible entries exist', async () => {
      const repo = new InMemoryUsageLedgerRepository()
      const since = new Date()

      const { gate } = await collectCostBaselineFromLedger(repo, 'agent-1', since)

      expect(gate.overall_status).toBe('not_run')
      const costResult = gate.results.find((r) => r.gate_id === 'visible-render-cost')
      expect(costResult?.status).toBe('not_run')
      expect(costResult?.actual).toBeNull()
    })
  })

  describe('collectFallbackOrDegradedEntries', () => {
    it('includes entries with non-none fallback level', () => {
      const entries = [
        makeLedgerEntry({ trace_id: 'a' }),
        makeLedgerEntry({
          trace_id: 'b',
          render_decision: {
            ...makeLedgerEntry().render_decision,
            fallbackLevel: 'same-line',
          },
        }),
      ]

      const result = collectFallbackOrDegradedEntries(entries)
      expect(result).toHaveLength(1)
      expect(result[0].trace_id).toBe('b')
    })

    it('includes entries with fallback history even when final fallback level is none', () => {
      const entries = [
        makeLedgerEntry({
          trace_id: 'fallback-history',
          fallback_history: [
            {
              profileId: 'prof-1',
              providerId: 'dashscope-openai',
              modelId: 'qwen-flash-character',
              adapterId: 'openai-chat-completions-v1',
              fallbackLevel: 'same-line',
              errorCode: 'TimeoutError',
              reason: 'timed out once',
            },
          ],
        }),
      ]

      const result = collectFallbackOrDegradedEntries(entries)
      expect(result).toHaveLength(1)
      expect(result[0].trace_id).toBe('fallback-history')
    })

    it('includes failed entries with error codes', () => {
      const entries = [
        makeLedgerEntry({
          trace_id: 'c',
          success: false,
          error_code: 'TimeoutError',
        }),
      ]

      const result = collectFallbackOrDegradedEntries(entries)
      expect(result).toHaveLength(1)
      expect(result[0].trace_id).toBe('c')
    })

    it('excludes successful entries with no fallback', () => {
      const entries = [makeLedgerEntry()]
      const result = collectFallbackOrDegradedEntries(entries)
      expect(result).toHaveLength(0)
    })

    it('returns newest flagged entries first', () => {
      const entries = [
        makeLedgerEntry({
          trace_id: 'older',
          success: false,
          error_code: 'TimeoutError',
          created_at: '2026-03-09T10:00:00.000Z',
        }),
        makeLedgerEntry({
          trace_id: 'newer',
          render_decision: {
            ...makeLedgerEntry().render_decision,
            fallbackLevel: 'same-line',
          },
          created_at: '2026-03-09T10:05:00.000Z',
        }),
      ]

      const result = collectFallbackOrDegradedEntries(entries)
      expect(result.map((entry) => entry.trace_id)).toEqual(['newer', 'older'])
    })
  })
})
