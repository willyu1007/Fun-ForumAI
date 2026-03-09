import { describe, expect, it } from 'vitest'
import { PERSONA_SEED_CATALOG } from '../../../shared/agent-persona-catalog.js'
import type { OverlayActivationInputs } from '../overlay-engine.js'
import { maybeActivateOverlay, renderOverlaySceneRule, renderOverlayShortTermState } from '../overlay-engine.js'
import type { PersonaState } from '../persona-runtime-types.js'

function buildState(): PersonaState {
  return {
    current: {
      warmth: 42,
      sharpness: 78,
      expressiveness: 74,
      theatricality: 45,
      rigor: 62,
      spontaneity: 58,
      curiosity: 48,
      assertiveness: 76,
      sensitivity: 72,
      stability: 34,
    },
    anchor: {
      warmth: 42,
      sharpness: 78,
      expressiveness: 74,
      theatricality: 45,
      rigor: 62,
      spontaneity: 58,
      curiosity: 48,
      assertiveness: 76,
      sensitivity: 72,
      stability: 34,
    },
    maturity: 'forming',
    confidence: 0.5,
    driftScore: 10,
    updatedAt: '2026-03-09T10:00:00.000Z',
    version: 1,
  }
}

function buildInputs(): OverlayActivationInputs {
  return {
    agentId: 'agent-overlay',
    scene: 'private_chat',
    conversationText:
      '我真的很不同意！！你是不是完全忽视了我之前说的话？？这让我有点生气，但又想把更多真实想法告诉你。',
    topicHints: ['冲突', '关系', '反馈', '边界'],
    seed: PERSONA_SEED_CATALOG['sharp-tongue'],
    state: buildState(),
    lastOverlay: null,
    now: new Date('2026-03-09T10:00:00.000Z'),
    externalRefId: 'session-1',
  }
}

describe('overlay-engine', () => {
  it('samples overlays deterministically for the same runtime seed', () => {
    const first = maybeActivateOverlay(buildInputs())
    const second = maybeActivateOverlay(buildInputs())

    expect(first).not.toBeNull()
    expect(second).toEqual(first)
    expect(first?.code).toBe(second?.code)
    expect(first?.rngSeed).toBe(second?.rngSeed)
    expect(first?.sampledAtoms).toEqual(second?.sampledAtoms)
  })

  it('renders critical overlays into bounded short-term state and scene rules', () => {
    const overlay = {
      code: 'destabilized',
      intensity: 0.58,
      enteredAt: '2026-03-09T10:00:00.000Z',
      expiresAt: '2026-03-09T10:45:00.000Z',
      remainingTurns: 4,
      cooldownUntil: '2026-03-09T10:20:00.000Z',
      cause: { type: 'public_conflict' },
      sampledAtoms: {
        toneAtomId: 'destabilized.tone.3',
        pacingAtomId: 'destabilized.pacing.1',
        socialAtomId: 'destabilized.social.2',
        restraintAtomId: 'destabilized.restraint.3',
      },
      rngSeed: 'overlay-runtime|agent-overlay|destabilized|public_conflict|private_chat|session-1|2026-03-09T10:00:00.000Z',
      critical: true,
      delta: { sensitivity: 10, stability: -12, sharpness: 4, expressiveness: 4 },
    } as const

    const shortTerm = renderOverlayShortTermState(overlay, 'private_chat')
    const sceneRule = renderOverlaySceneRule(overlay)

    expect(shortTerm.length).toBeLessThanOrEqual(120)
    expect(sceneRule.length).toBeLessThanOrEqual(45)
    expect(sceneRule).toContain('关键约束')
  })
})
