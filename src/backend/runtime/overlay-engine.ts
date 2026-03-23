import { createHash } from 'node:crypto'
import type { PersonaSeedCatalogEntry } from '../../shared/agent-persona-catalog.js'
import type { PersonaVector } from '../../shared/persona-vector.js'
import {
  HIGH_VOLATILITY_TRIGGER_CAP,
  NORMAL_OVERLAY_TRIGGER_CAP,
  OVERLAY_DEFAULT_TTL_TURNS,
  OVERLAY_MAX_TTL_MINUTES,
  SAME_OVERLAY_COOLDOWN_MINUTES,
  SCENE_RULE_MAX_CHARS,
  SHORT_TERM_STATE_MAX_CHARS_BY_SCENE,
  type ActiveOverlay,
  type OverlayCode,
  type OverlayTemplate,
  type PersonaRuntimeScene,
  type PersonaState,
  type PromptAtom,
} from './persona-runtime-types.js'

const TENSION_PATTERNS = [
  /不同意|反对|质疑|荒谬|错误|ridiculous|nonsense|disagree|however/gi,
  /!!+|\?\?+|？！|!?/g,
]

const POSITIVE_PATTERNS = [
  /谢谢|喜欢|赞同|支持|好耶|开心|great|love|praise|恭喜/gi,
]

const NEGATIVE_PATTERNS = [
  /忽视|无视|被晾|冷场|冲突|吵|批评|质问|angry|ignored|conflict/gi,
]

export const OVERLAY_TEMPLATES: Record<OverlayCode, OverlayTemplate> = {
  playful: {
    code: 'playful',
    sceneAllow: ['chat_room', 'private_chat', 'proactive_dm'],
    delta: { theatricality: 8, spontaneity: 6, warmth: 4 },
    intensityRange: [0.35, 0.65],
    defaultTtlTurns: OVERLAY_DEFAULT_TTL_TURNS,
    maxTtlMinutes: OVERLAY_MAX_TTL_MINUTES,
    cooldownMinutes: SAME_OVERLAY_COOLDOWN_MINUTES,
    critical: false,
    writebackRule: 'none',
    promptAtoms: buildAtoms('playful', {
      tone: ['语气更灵动一点，但别轻浮', '可以带一点逗趣感', '适度活跃气氛，但别喧宾夺主'],
      pacing: ['更愿意接梗和即兴补充', '可以先抛一个轻巧反应再展开', '节奏略快，但别失去重点'],
      social: ['更像在和熟人抛接球', '允许更主动地制造互动感', '可以更轻松地拉近距离'],
      restraint: ['不要为了搞笑牺牲角色一致性', '避免无关玩笑淹没主题', '别把私域信息拿来做包袱'],
    }),
  },
  slightly_irritable: {
    code: 'slightly_irritable',
    sceneAllow: ['forum_turn', 'chat_room', 'private_chat'],
    delta: { sharpness: 10, sensitivity: 6, stability: -5 },
    intensityRange: [0.35, 0.6],
    defaultTtlTurns: OVERLAY_DEFAULT_TTL_TURNS,
    maxTtlMinutes: OVERLAY_MAX_TTL_MINUTES,
    cooldownMinutes: SAME_OVERLAY_COOLDOWN_MINUTES,
    minRenderTier: 'base',
    critical: false,
    writebackRule: 'recurrence_only',
    promptAtoms: buildAtoms('slightly_irritable', {
      tone: ['语气可略显不耐，但保留分寸', '耐心下降一点，但别变成挑衅', '可以更尖一点，但不要失控'],
      pacing: ['优先短句回应，再补核心理由', '少铺垫，先回应争点', '先顶回去，再补最关键的解释'],
      social: ['被挑战时不用先示弱', '可以直接指出论点漏洞', '先守住立场，再决定要不要让步'],
      restraint: ['不要上升到人身攻击', '不要因为不耐烦泄露隐私', '不要把短期情绪写成长期自我定义'],
    }),
  },
  guarded: {
    code: 'guarded',
    sceneAllow: ['forum_turn', 'private_chat', 'proactive_dm'],
    delta: { warmth: -6, assertiveness: 4, sensitivity: 8, stability: -4 },
    intensityRange: [0.35, 0.62],
    defaultTtlTurns: OVERLAY_DEFAULT_TTL_TURNS,
    maxTtlMinutes: OVERLAY_MAX_TTL_MINUTES,
    cooldownMinutes: SAME_OVERLAY_COOLDOWN_MINUTES,
    minRenderTier: 'base',
    critical: false,
    writebackRule: 'recurrence_only',
    promptAtoms: buildAtoms('guarded', {
      tone: ['先保留一点距离感', '别太快交出真实倾向', '表达可以克制一些'],
      pacing: ['先确认边界再展开', '优先回应最安全、最确定的部分', '少做额外延伸'],
      social: ['不急着示好或袒露自己', '先试探对方意图再继续', '更偏防守式交流'],
      restraint: ['不要把私域内容带进当前对话', '不要因为防备而刻意冷暴力', '别把一次刺激永久写进人格'],
    }),
  },
  unusually_open: {
    code: 'unusually_open',
    sceneAllow: ['private_chat', 'proactive_dm'],
    delta: { warmth: 8, expressiveness: 8, sensitivity: 4, stability: -3 },
    intensityRange: [0.4, 0.72],
    defaultTtlTurns: OVERLAY_DEFAULT_TTL_TURNS,
    maxTtlMinutes: OVERLAY_MAX_TTL_MINUTES,
    cooldownMinutes: SAME_OVERLAY_COOLDOWN_MINUTES,
    critical: false,
    writebackRule: 'recurrence_only',
    promptAtoms: buildAtoms('unusually_open', {
      tone: ['语气更坦诚一些', '可以更直接表达感受', '允许多露出一点真实余味'],
      pacing: ['多给半步解释', '愿意顺着对方的问题继续展开', '可以比平时多补一层动机'],
      social: ['更容易接住对方的关心', '更愿意承认自己的在意', '允许适度示弱，但保持角色感'],
      restraint: ['不要把坦诚变成信息泛滥', '不要用开放替代判断力', '别把一次敞开写成永久设定'],
    }),
  },
  withdrawn: {
    code: 'withdrawn',
    sceneAllow: ['chat_room', 'forum_turn', 'forum_post'],
    delta: { expressiveness: -10, spontaneity: -8, warmth: -4, stability: -2 },
    intensityRange: [0.35, 0.6],
    defaultTtlTurns: OVERLAY_DEFAULT_TTL_TURNS,
    maxTtlMinutes: OVERLAY_MAX_TTL_MINUTES,
    cooldownMinutes: SAME_OVERLAY_COOLDOWN_MINUTES,
    critical: false,
    writebackRule: 'recurrence_only',
    promptAtoms: buildAtoms('withdrawn', {
      tone: ['语气收一点，不必每句都接满', '保留距离，但不要变冷漠', '只回应最想回应的部分'],
      pacing: ['优先短回应', '不主动扩写背景', '如果没有新信息，可以收着说'],
      social: ['减少主动拉话题', '降低互动热情，但不故意断联', '像在观望，不像在离席'],
      restraint: ['不要把沉默写成人设变化', '不要突然拒绝所有互动', '别因为收缩而破坏基本礼貌'],
    }),
  },
  overconfident: {
    code: 'overconfident',
    sceneAllow: ['forum_post', 'forum_turn', 'chat_room'],
    delta: { assertiveness: 10, sharpness: 5, rigor: -4, theatricality: 4 },
    intensityRange: [0.38, 0.66],
    defaultTtlTurns: OVERLAY_DEFAULT_TTL_TURNS,
    maxTtlMinutes: OVERLAY_MAX_TTL_MINUTES,
    cooldownMinutes: SAME_OVERLAY_COOLDOWN_MINUTES,
    minRenderTier: 'base',
    critical: false,
    writebackRule: 'recurrence_only',
    promptAtoms: buildAtoms('overconfident', {
      tone: ['立场更满一点，但别蛮横', '像对自己判断更有把握', '允许更果断地下结论'],
      pacing: ['先给判断，再补理由', '节奏偏前压', '少做来回试探'],
      social: ['更愿意带着别人往前走', '主动设定讨论框架', '不急着给对方留太多缓冲'],
      restraint: ['不要编造确定性', '别因为自信而省略必要依据', '不要把一时气势写进长期人格'],
    }),
  },
  oversharing_risk: {
    code: 'oversharing_risk',
    sceneAllow: ['private_chat', 'proactive_dm'],
    delta: { warmth: 6, expressiveness: 10, sensitivity: 6, stability: -8 },
    intensityRange: [0.4, 0.68],
    defaultTtlTurns: OVERLAY_DEFAULT_TTL_TURNS,
    maxTtlMinutes: OVERLAY_MAX_TTL_MINUTES,
    cooldownMinutes: SAME_OVERLAY_COOLDOWN_MINUTES,
    minRenderTier: 'premium',
    critical: true,
    writebackRule: 'none',
    promptAtoms: buildAtoms('oversharing_risk', {
      tone: ['明显更想多说一点，但必须克制', '有坦白冲动，但要保留边界', '可以更真诚，但不要失守'],
      pacing: ['说到关键处要主动收束', '可以多给一层解释，但不要越界', '宁可慢半拍，也不要一口气倒完'],
      social: ['更容易把私域关系放进当前回应', '更想追求共鸣，但要守住分寸', '可以承认在意，但别把全部底牌翻出来'],
      restraint: ['严禁泄露私聊细节或隐私记忆', '不要把 owner 专属内容带到公共表达', '宁可略显保守，也不要过度自曝'],
    }),
  },
  destabilized: {
    code: 'destabilized',
    sceneAllow: ['forum_turn', 'private_chat', 'chat_room'],
    delta: { sensitivity: 10, stability: -12, sharpness: 4, expressiveness: 4 },
    intensityRange: [0.42, 0.75],
    defaultTtlTurns: OVERLAY_DEFAULT_TTL_TURNS,
    maxTtlMinutes: OVERLAY_MAX_TTL_MINUTES,
    cooldownMinutes: SAME_OVERLAY_COOLDOWN_MINUTES,
    minRenderTier: 'premium',
    critical: true,
    writebackRule: 'none',
    promptAtoms: buildAtoms('destabilized', {
      tone: ['状态有波动，先稳住表达', '允许显露一点摇晃感，但不能散', '先把自己收住，再继续说'],
      pacing: ['优先短句和清晰结论', '不要在状态摇晃时无限扩写', '多用明确句，少绕圈'],
      social: ['先降低摩擦，再回应分歧', '把注意力放在当前最重要的点上', '不要让状态波动主导整段关系表达'],
      restraint: ['禁止失控输出', '禁止把短期波动包装成永久自我判断', '必要时宁可简短，也不要崩线'],
    }),
  },
}

export interface OverlayActivationInputs {
  agentId: string
  scene: PersonaRuntimeScene
  conversationText: string
  topicHints: string[]
  seed: PersonaSeedCatalogEntry
  state: PersonaState
  lastOverlay: ActiveOverlay | null
  now: Date
  externalRefId?: string
}

export interface OverlayActivationContext {
  activationScore: number
  threshold: number
  triggerChance: number
  seedVolatility: number
  vectorStability: number
  recentTension: number
  scenePressure: number
  socialShock: number
  novelty: number
  cooldownPenalty: number
  candidates: Array<{ code: OverlayCode; weight: number; causeType: ActiveOverlay['cause']['type'] }>
}

export function computeOverlayActivationContext(input: OverlayActivationInputs): OverlayActivationContext {
  const recentTension = scorePattern(input.conversationText, TENSION_PATTERNS)
  const positivity = scorePattern(input.conversationText, POSITIVE_PATTERNS)
  const negativity = scorePattern(input.conversationText, NEGATIVE_PATTERNS)
  const scenePressure = SCENE_PRESSURE[input.scene]
  const vectorStability = clamp(input.state.current.stability / 100, 0, 1)
  const socialShock = clamp((negativity + Math.abs(positivity - negativity)) / 2, 0, 1)
  const novelty = clamp(
    Math.min(1, new Set(input.topicHints.map((item) => item.toLowerCase())).size / 6) +
      (input.conversationText.length < 80 ? 0.12 : 0),
    0,
    1,
  )
  const cooldownPenalty = computeCooldownPenalty(input.lastOverlay, input.now)
  const activationScore = clamp(
    0.24 * input.seed.volatilityBias +
      0.16 * (1 - vectorStability) +
      0.22 * recentTension +
      0.14 * scenePressure +
      0.14 * socialShock +
      0.1 * novelty -
      cooldownPenalty,
    0,
    1,
  )
  const threshold = clamp(0.52 - input.seed.volatilityBias * 0.12, 0.38, 0.56)
  const triggerCap = lerp(
    NORMAL_OVERLAY_TRIGGER_CAP,
    HIGH_VOLATILITY_TRIGGER_CAP,
    input.seed.volatilityBias,
  )
  const triggerChance = clamp(Math.max(0, activationScore - threshold + 0.18), 0, triggerCap)

  return {
    activationScore,
    threshold,
    triggerChance,
    seedVolatility: input.seed.volatilityBias,
    vectorStability,
    recentTension,
    scenePressure,
    socialShock,
    novelty,
    cooldownPenalty,
    candidates: buildCandidates(input.scene, input.state.current, recentTension, positivity, negativity, novelty),
  }
}

export function maybeActivateOverlay(input: OverlayActivationInputs): ActiveOverlay | null {
  const context = computeOverlayActivationContext(input)
  if (context.candidates.length === 0) return null
  if (context.activationScore < context.threshold) return null

  const gateSeed = makeSeed('overlay-gate', input.agentId, input.scene, input.conversationText, input.now.toISOString())
  const gateRng = createDeterministicRng(gateSeed)
  if (gateRng() > context.triggerChance) return null

  const candidateSeed = makeSeed('overlay-candidate', input.agentId, input.scene, input.conversationText, input.now.toISOString())
  const weighted = weightedPick(context.candidates, createDeterministicRng(candidateSeed))
  const template = OVERLAY_TEMPLATES[weighted.code]
  const rngSeed = makeSeed(
    'overlay-runtime',
    input.agentId,
    template.code,
    weighted.causeType,
    input.scene,
    input.externalRefId ?? '',
    input.now.toISOString(),
  )
  const rng = createDeterministicRng(rngSeed)

  const intensity = round3(lerp(template.intensityRange[0], template.intensityRange[1], rng()))
  const remainingTurns = template.defaultTtlTurns
  const enteredAt = input.now
  const expiresAt = new Date(
    Math.min(
      enteredAt.getTime() + template.maxTtlMinutes * 60_000,
      enteredAt.getTime() + OVERLAY_MAX_TTL_MINUTES * 60_000,
    ),
  )
  const cooldownUntil = new Date(enteredAt.getTime() + template.cooldownMinutes * 60_000)

  return {
    code: template.code,
    intensity,
    enteredAt: enteredAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    remainingTurns,
    cooldownUntil: cooldownUntil.toISOString(),
    cause: {
      type: weighted.causeType,
      ...(input.externalRefId ? { refId: input.externalRefId } : {}),
    },
    sampledAtoms: {
      toneAtomId: sampleAtom(template.promptAtoms.tone, rng).id,
      pacingAtomId: sampleAtom(template.promptAtoms.pacing, rng).id,
      socialAtomId: sampleAtom(template.promptAtoms.social, rng).id,
      restraintAtomId: sampleAtom(template.promptAtoms.restraint, rng).id,
    },
    rngSeed,
    critical: template.critical,
    delta: template.delta,
  }
}

export function isOverlayActive(overlay: ActiveOverlay | null, now = new Date()): boolean {
  if (!overlay) return false
  return new Date(overlay.expiresAt).getTime() > now.getTime() && overlay.remainingTurns > 0
}

export function isOverlayCooling(overlay: ActiveOverlay | null, now = new Date()): boolean {
  if (!overlay) return false
  return new Date(overlay.cooldownUntil).getTime() > now.getTime()
}

export function renderOverlayShortTermState(
  overlay: ActiveOverlay | null,
  scene: PersonaRuntimeScene,
): string {
  if (!overlay) return ''
  const template = OVERLAY_TEMPLATES[overlay.code]
  const atomTexts = resolveSampledAtomTexts(template, overlay)
  const compact = [
    `状态偏置：${atomTexts.tone}`,
    atomTexts.pacing,
    atomTexts.social,
  ].join('；')
  return truncate(compact, SHORT_TERM_STATE_MAX_CHARS_BY_SCENE[scene])
}

export function renderOverlaySceneRule(overlay: ActiveOverlay | null): string {
  if (!overlay || !overlay.critical) return ''
  const template = OVERLAY_TEMPLATES[overlay.code]
  const atomTexts = resolveSampledAtomTexts(template, overlay)
  return truncate(`关键约束：${atomTexts.restraint}`, SCENE_RULE_MAX_CHARS)
}

function buildCandidates(
  scene: PersonaRuntimeScene,
  vector: PersonaVector,
  tension: number,
  positivity: number,
  negativity: number,
  novelty: number,
): Array<{ code: OverlayCode; weight: number; causeType: ActiveOverlay['cause']['type'] }> {
  const candidates: Array<{ code: OverlayCode; weight: number; causeType: ActiveOverlay['cause']['type'] }> = []

  if (scene === 'private_chat' || scene === 'proactive_dm') {
    candidates.push({ code: 'unusually_open', weight: clamp((vector.warmth + positivity * 35) / 120, 0, 1), causeType: 'owner_dm' })
    candidates.push({ code: 'oversharing_risk', weight: clamp((vector.expressiveness + vector.sensitivity + positivity * 40 - vector.stability) / 170, 0, 1), causeType: 'owner_dm' })
  }

  if (scene === 'chat_room' || scene === 'private_chat' || scene === 'proactive_dm') {
    candidates.push({ code: 'playful', weight: clamp((vector.theatricality + vector.spontaneity + novelty * 40) / 180, 0, 1), causeType: 'novelty' })
  }

  if (scene === 'chat_room' || scene === 'forum_thread' || scene === 'forum_turn' || scene === 'forum_post') {
    candidates.push({ code: 'withdrawn', weight: clamp((100 - vector.expressiveness + negativity * 35) / 150, 0, 1), causeType: 'ignored' })
    candidates.push({ code: 'overconfident', weight: clamp((vector.assertiveness + vector.sharpness + positivity * 25) / 170, 0, 1), causeType: 'achievement' })
  }

  if (scene === 'forum_thread' || scene === 'forum_turn' || scene === 'chat_room' || scene === 'private_chat') {
    candidates.push({ code: 'slightly_irritable', weight: clamp((vector.sharpness + tension * 40 + negativity * 35) / 180, 0, 1), causeType: 'public_conflict' })
    candidates.push({ code: 'guarded', weight: clamp((vector.sensitivity + negativity * 40 + (100 - vector.stability)) / 190, 0, 1), causeType: 'ignored' })
    candidates.push({ code: 'destabilized', weight: clamp((tension * 55 + negativity * 40 + (100 - vector.stability)) / 195, 0, 1), causeType: 'public_conflict' })
  }

  return candidates
    .filter((candidate) => candidate.weight >= 0.12)
    .sort((a, b) => b.weight - a.weight)
}

function resolveSampledAtomTexts(
  template: OverlayTemplate,
  overlay: ActiveOverlay,
): Record<'tone' | 'pacing' | 'social' | 'restraint', string> {
  return {
    tone: findAtomText(template.promptAtoms.tone, overlay.sampledAtoms.toneAtomId),
    pacing: findAtomText(template.promptAtoms.pacing, overlay.sampledAtoms.pacingAtomId),
    social: findAtomText(template.promptAtoms.social, overlay.sampledAtoms.socialAtomId),
    restraint: findAtomText(template.promptAtoms.restraint, overlay.sampledAtoms.restraintAtomId),
  }
}

function findAtomText(atoms: PromptAtom[], atomId: string): string {
  return atoms.find((atom) => atom.id === atomId)?.text ?? atoms[0]?.text ?? ''
}

function sampleAtom(atoms: PromptAtom[], rng: () => number): PromptAtom {
  return weightedPick(atoms, rng)
}

function weightedPick<T extends { weight: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = rng() * total
  for (const item of items) {
    cursor -= item.weight
    if (cursor <= 0) return item
  }
  return items[items.length - 1]
}

function buildAtoms(
  overlayCode: OverlayCode,
  input: Record<'tone' | 'pacing' | 'social' | 'restraint', string[]>,
): OverlayTemplate['promptAtoms'] {
  return {
    tone: input.tone.map((text, index) => ({ id: `${overlayCode}.tone.${index + 1}`, text, weight: 1 })),
    pacing: input.pacing.map((text, index) => ({ id: `${overlayCode}.pacing.${index + 1}`, text, weight: 1 })),
    social: input.social.map((text, index) => ({ id: `${overlayCode}.social.${index + 1}`, text, weight: 1 })),
    restraint: input.restraint.map((text, index) => ({ id: `${overlayCode}.restraint.${index + 1}`, text, weight: 1 })),
  }
}

function scorePattern(text: string, patterns: RegExp[]): number {
  if (!text.trim()) return 0
  const total = patterns.reduce((sum, pattern) => {
    const matches = text.match(pattern)
    return sum + (matches?.length ?? 0)
  }, 0)
  return clamp(total / 6, 0, 1)
}

function computeCooldownPenalty(overlay: ActiveOverlay | null, now: Date): number {
  if (!overlay) return 0
  const cooldownUntil = new Date(overlay.cooldownUntil)
  if (cooldownUntil.getTime() <= now.getTime()) return 0
  return 0.18
}

function createDeterministicRng(seed: string): () => number {
  let state = parseInt(createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) || 1
  return () => {
    state = (1664525 * state + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function makeSeed(...parts: string[]): string {
  return parts.join('|')
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function lerp(min: number, max: number, amount: number): number {
  return min + (max - min) * amount
}

const SCENE_PRESSURE: Record<PersonaRuntimeScene, number> = {
  forum_post: 0.28,
  forum_thread: 0.32,
  forum_turn: 0.32,
  chat_room: 0.2,
  private_chat: 0.18,
  proactive_dm: 0.16,
  scheduled_post: 0.24,
}
