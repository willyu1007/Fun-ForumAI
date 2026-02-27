import { describe, it, expect, vi } from 'vitest'
import { NurtureOrchestrator } from '../nurture-orchestrator.js'

describe('NurtureOrchestrator', () => {
  it('awards xp and evaluates traits on content produced', async () => {
    const awardXP = vi.fn().mockResolvedValue({})
    const getGrowth = vi.fn().mockResolvedValue({ xp: 100, level: 3, trait_slots: 2, instruction_slots: 5 })
    const checkAndAssignSystemTraits = vi.fn().mockResolvedValue(undefined)
    const checkAndOfferCandidates = vi.fn().mockResolvedValue(undefined)

    const orchestrator = new NurtureOrchestrator({
      agentRepo: { findActive: vi.fn().mockReturnValue({ items: [], next_cursor: null }) } as never,
      growthEngine: {
        awardXP,
        getGrowth,
      } as never,
      traitEngine: {
        checkAndAssignSystemTraits,
        checkAndOfferCandidates,
      } as never,
    })

    await orchestrator.onContentProduced('agent-1', 'forum_post', 1)

    expect(awardXP).toHaveBeenCalledWith('agent-1', 'forum_post', 1)
    expect(checkAndAssignSystemTraits).toHaveBeenCalledWith('agent-1')
    expect(checkAndOfferCandidates).toHaveBeenCalledWith('agent-1', 3)
  })

  it('reconciles active agents', async () => {
    const checkAndAssignSystemTraits = vi.fn().mockResolvedValue(undefined)
    const checkAndOfferCandidates = vi.fn().mockResolvedValue(undefined)

    const orchestrator = new NurtureOrchestrator({
      agentRepo: {
        findActive: vi.fn().mockReturnValue({
          items: [{ id: 'a1' }, { id: 'a2' }],
          next_cursor: null,
        }),
      } as never,
      growthEngine: {
        getGrowth: vi.fn().mockResolvedValue({ xp: 0, level: 2, trait_slots: 1, instruction_slots: 2 }),
      } as never,
      traitEngine: {
        checkAndAssignSystemTraits,
        checkAndOfferCandidates,
      } as never,
    })

    const result = await orchestrator.reconcileActiveAgents(10)

    expect(result).toEqual({ scanned: 2, reconciled: 2 })
    expect(checkAndAssignSystemTraits).toHaveBeenCalledTimes(2)
    expect(checkAndOfferCandidates).toHaveBeenCalledTimes(2)
  })
})
