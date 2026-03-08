import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_NURTURE_DEDUP_WINDOW_MS, NurtureOrchestrator } from '../nurture-orchestrator.js'

function buildOrchestrator(overrides?: {
  hasRecentXpDedupKey?: (agentId: string, dedupKey: string, windowMs: number) => Promise<boolean>
  assignedSystemTraits?: string[]
}) {
  const awardXP = vi.fn().mockResolvedValue({})
  const awardPrivateChatXP = vi.fn().mockResolvedValue({ awarded: true, xp: 3 })
  const hasRecentXpDedupKey = overrides?.hasRecentXpDedupKey
    ? vi.fn(overrides.hasRecentXpDedupKey)
    : vi.fn().mockResolvedValue(false)
  const checkAndAssignSystemTraits = vi.fn().mockResolvedValue(overrides?.assignedSystemTraits ?? [])
  const checkAndOfferCandidates = vi.fn().mockResolvedValue(undefined)
  const recordTraitMutation = vi.fn().mockResolvedValue(undefined)

  const orchestrator = new NurtureOrchestrator({
    agentRepo: {
      findActive: vi.fn().mockReturnValue({
        items: [{ id: 'a1' }, { id: 'a2' }],
        next_cursor: null,
      }),
    } as never,
    xpService: {
      awardXP,
      awardPrivateChatXP,
      hasRecentXpDedupKey,
    } as never,
    traitEngine: {
      checkAndAssignSystemTraits,
      checkAndOfferCandidates,
    } as never,
    personaStateService: {
      recordTraitMutation,
    } as never,
  })

  return {
    orchestrator,
    awardXP,
    awardPrivateChatXP,
    hasRecentXpDedupKey,
    checkAndAssignSystemTraits,
    checkAndOfferCandidates,
    recordTraitMutation,
  }
}

describe('NurtureOrchestrator', () => {
  it('awards xp and evaluates traits when dedup key is not seen in the window', async () => {
    const ctx = buildOrchestrator()

    await ctx.orchestrator.onContentProduced('agent-1', 'forum_post', 1, {
      dedup_key: 'content:c-1',
      dedup_window_ms: 1234,
    })

    expect(ctx.hasRecentXpDedupKey).toHaveBeenCalledWith('agent-1', 'content:c-1', 1234)
    expect(ctx.awardXP).toHaveBeenCalledWith('agent-1', 'forum_post', 1, { dedup_key: 'content:c-1' })
    expect(ctx.checkAndAssignSystemTraits).toHaveBeenCalledWith('agent-1')
    expect(ctx.checkAndOfferCandidates).toHaveBeenCalledWith('agent-1')
  })

  it('uses default 24h dedup window when dedup window is missing', async () => {
    const ctx = buildOrchestrator()

    await ctx.orchestrator.onContentProduced('agent-1', 'forum_comment', 1, {
      dedup_key: 'content:c-2',
    })

    expect(ctx.hasRecentXpDedupKey).toHaveBeenCalledWith(
      'agent-1',
      'content:c-2',
      DEFAULT_NURTURE_DEDUP_WINDOW_MS,
    )
  })

  it('skips xp and trait evaluation when dedup key already exists in window', async () => {
    const ctx = buildOrchestrator({
      hasRecentXpDedupKey: async (_agentId, dedupKey) => dedupKey === 'content:dup',
    })

    await ctx.orchestrator.onContentProduced('agent-1', 'forum_post', 1, { dedup_key: 'content:dup' })

    expect(ctx.awardXP).not.toHaveBeenCalled()
    expect(ctx.checkAndAssignSystemTraits).not.toHaveBeenCalled()
    expect(ctx.checkAndOfferCandidates).not.toHaveBeenCalled()
  })

  it('does not let one dedup key block another key', async () => {
    const ctx = buildOrchestrator({
      hasRecentXpDedupKey: async (_agentId, dedupKey) => dedupKey === 'content:dup',
    })

    await ctx.orchestrator.onContentProduced('agent-1', 'forum_post', 1, { dedup_key: 'content:dup' })
    await ctx.orchestrator.onContentProduced('agent-1', 'forum_post', 1, { dedup_key: 'content:new' })

    expect(ctx.awardXP).toHaveBeenCalledTimes(1)
    expect(ctx.awardXP).toHaveBeenCalledWith('agent-1', 'forum_post', 1, { dedup_key: 'content:new' })
    expect(ctx.hasRecentXpDedupKey).toHaveBeenCalledTimes(2)
  })

  it('falls back to normal award path when dedup check errors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = buildOrchestrator({
      hasRecentXpDedupKey: async () => {
        throw new Error('db unavailable')
      },
    })

    await ctx.orchestrator.onContentProduced('agent-1', 'forum_post', 1, { dedup_key: 'content:c-3' })

    expect(ctx.awardXP).toHaveBeenCalledTimes(1)
    expect(ctx.awardXP).toHaveBeenCalledWith('agent-1', 'forum_post', 1, { dedup_key: 'content:c-3' })
    warnSpy.mockRestore()
  })

  it('applies dedup checks for private digest trigger', async () => {
    const ctx = buildOrchestrator({
      hasRecentXpDedupKey: async (_agentId, dedupKey) => dedupKey === 'session:s-dup',
    })

    await ctx.orchestrator.onPrivateDigestCompleted('agent-1', 8, { dedup_key: 'session:s-dup' })
    await ctx.orchestrator.onPrivateDigestCompleted('agent-1', 8, { dedup_key: 'session:s-ok' })

    expect(ctx.awardPrivateChatXP).toHaveBeenCalledTimes(1)
    expect(ctx.awardPrivateChatXP).toHaveBeenCalledWith('agent-1', 8, { dedup_key: 'session:s-ok' })
    expect(ctx.checkAndAssignSystemTraits).toHaveBeenCalledTimes(1)
  })

  it('reconciles active agents', async () => {
    const ctx = buildOrchestrator()

    const result = await ctx.orchestrator.reconcileActiveAgents(10)

    expect(result).toEqual({ scanned: 2, reconciled: 2 })
    expect(ctx.checkAndAssignSystemTraits).toHaveBeenCalledTimes(2)
    expect(ctx.checkAndOfferCandidates).toHaveBeenCalledTimes(2)
  })

  it('writes back newly auto-equipped system traits into persona runtime state', async () => {
    const ctx = buildOrchestrator({
      assignedSystemTraits: ['helpful', 'slow_starter'],
    })

    await ctx.orchestrator.onContentProduced('agent-1', 'forum_post')

    expect(ctx.recordTraitMutation).toHaveBeenCalledTimes(2)
    expect(ctx.recordTraitMutation).toHaveBeenNthCalledWith(1, 'agent-1', 'helpful', 'equip')
    expect(ctx.recordTraitMutation).toHaveBeenNthCalledWith(2, 'agent-1', 'slow_starter', 'equip')
  })
})
