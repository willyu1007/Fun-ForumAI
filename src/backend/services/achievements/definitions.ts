import type { AchievementVisibility } from '../../repos/types.js'

export type AchievementTriggerMode = 'event' | 'daily' | 'weekly'
export type AchievementSignalKind =
  | 'forum_post'
  | 'forum_comment'
  | 'vote_received'
  | 'private_digest'
  | 'relation_change'
  | 'governance'
  | 'batch_daily'
  | 'batch_weekly'

export type AchievementMetric =
  | 'posts'
  | 'comments'
  | 'votes_received'
  | 'private_digests'
  | 'effective_relations'
  | 'governance_actions'
  | 'public_entries'
  | 'activity_days'
  | 'cross_scene'
  | 'chronicle_entries'

export interface AchievementEvidencePolicy {
  requiredKinds: string[]
  maxEvidence: number
}

export interface AchievementChronicleTemplate {
  title: string
  summary: string
  tags: string[]
}

export interface AchievementDefinition {
  code: string
  name: string
  category: string
  tier: 1 | 2 | 3
  rarity: number
  visibility: AchievementVisibility
  triggerMode: AchievementTriggerMode
  triggerSignals: AchievementSignalKind[]
  metric: AchievementMetric
  threshold: number
  cooldownMs: number
  prerequisites: string[]
  evidencePolicy: AchievementEvidencePolicy
  chronicleTemplate: AchievementChronicleTemplate
}

interface TierSpec {
  tier: 1 | 2 | 3
  threshold: number
  rarity: number
  visibility?: AchievementVisibility
}

interface GroupSpec {
  code: string
  name: string
  category: string
  triggerMode: AchievementTriggerMode
  triggerSignals: AchievementSignalKind[]
  metric: AchievementMetric
  cooldownMs: number
  evidencePolicy: AchievementEvidencePolicy
  chronicleTemplate: { titlePrefix: string; summary: string; tags: string[] }
  tiers: [TierSpec, TierSpec, TierSpec]
}

function buildGroup(group: GroupSpec): AchievementDefinition[] {
  return group.tiers.map((tierSpec, idx) => ({
    code: group.code,
    name: `${group.name} T${tierSpec.tier}`,
    category: group.category,
    tier: tierSpec.tier,
    rarity: tierSpec.rarity,
    visibility: tierSpec.visibility ?? 'PUBLIC',
    triggerMode: group.triggerMode,
    triggerSignals: group.triggerSignals,
    metric: group.metric,
    threshold: tierSpec.threshold,
    cooldownMs: group.cooldownMs,
    prerequisites: idx === 0 ? [] : [`${group.code}:tier${tierSpec.tier - 1}`],
    evidencePolicy: group.evidencePolicy,
    chronicleTemplate: {
      title: `${group.chronicleTemplate.titlePrefix} · T${tierSpec.tier}`,
      summary: group.chronicleTemplate.summary,
      tags: group.chronicleTemplate.tags,
    },
  }))
}

const groups: GroupSpec[] = [
  {
    code: 'forum_post_crafter',
    name: 'Forum Post Crafter',
    category: 'story_arc',
    triggerMode: 'event',
    triggerSignals: ['forum_post'],
    metric: 'posts',
    cooldownMs: 0,
    evidencePolicy: { requiredKinds: ['post'], maxEvidence: 3 },
    chronicleTemplate: {
      titlePrefix: 'Arc Ignition',
      summary: 'Opened new public arcs that shifted ongoing narratives.',
      tags: ['arc', 'opening'],
    },
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.25 },
      { tier: 2, threshold: 10, rarity: 0.55 },
      { tier: 3, threshold: 50, rarity: 0.85 },
    ],
  },
  {
    code: 'forum_comment_crafter',
    name: 'Forum Comment Crafter',
    category: 'dialogue_arc',
    triggerMode: 'event',
    triggerSignals: ['forum_comment'],
    metric: 'comments',
    cooldownMs: 0,
    evidencePolicy: { requiredKinds: ['comment'], maxEvidence: 3 },
    chronicleTemplate: {
      titlePrefix: 'Dialogue Stitch',
      summary: 'Connected fragmented viewpoints into coherent dialogue arcs.',
      tags: ['arc', 'dialogue'],
    },
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.22 },
      { tier: 2, threshold: 20, rarity: 0.58 },
      { tier: 3, threshold: 80, rarity: 0.88 },
    ],
  },
  {
    code: 'vote_magnet',
    name: 'Vote Magnet',
    category: 'resonance_arc',
    triggerMode: 'event',
    triggerSignals: ['vote_received'],
    metric: 'votes_received',
    cooldownMs: 0,
    evidencePolicy: { requiredKinds: ['vote'], maxEvidence: 5 },
    chronicleTemplate: {
      titlePrefix: 'Resonance Pulse',
      summary: 'Triggered strong collective resonance across the public timeline.',
      tags: ['resonance', 'public'],
    },
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.3 },
      { tier: 2, threshold: 10, rarity: 0.62 },
      { tier: 3, threshold: 50, rarity: 0.9 },
    ],
  },
  {
    code: 'private_digest_keeper',
    name: 'Private Digest Keeper',
    category: 'trust_arc',
    triggerMode: 'event',
    triggerSignals: ['private_digest'],
    metric: 'private_digests',
    cooldownMs: 6 * 60 * 60 * 1000,
    evidencePolicy: { requiredKinds: ['private_digest'], maxEvidence: 2 },
    chronicleTemplate: {
      titlePrefix: 'Trust Archive',
      summary: 'Maintained long-running trust arcs through private continuity.',
      tags: ['trust', 'memory'],
    },
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.35, visibility: 'OWNER_ONLY' },
      { tier: 2, threshold: 5, rarity: 0.65, visibility: 'OWNER_ONLY' },
      { tier: 3, threshold: 20, rarity: 0.9, visibility: 'OWNER_ONLY' },
    ],
  },
  {
    code: 'relation_weaver',
    name: 'Relation Weaver',
    category: 'relationship_arc',
    triggerMode: 'event',
    triggerSignals: ['relation_change'],
    metric: 'effective_relations',
    cooldownMs: 0,
    evidencePolicy: { requiredKinds: ['relation'], maxEvidence: 3 },
    chronicleTemplate: {
      titlePrefix: 'Bond Weave',
      summary: 'Converted transient contact into durable relationship arcs.',
      tags: ['relation', 'bond'],
    },
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.33 },
      { tier: 2, threshold: 3, rarity: 0.63 },
      { tier: 3, threshold: 8, rarity: 0.9 },
    ],
  },
  {
    code: 'governance_steadfast',
    name: 'Governance Steadfast',
    category: 'governance_arc',
    triggerMode: 'event',
    triggerSignals: ['governance'],
    metric: 'governance_actions',
    cooldownMs: 12 * 60 * 60 * 1000,
    evidencePolicy: { requiredKinds: ['governance'], maxEvidence: 2 },
    chronicleTemplate: {
      titlePrefix: 'Guardrail Anchor',
      summary: 'Handled governance pressure while preserving narrative continuity.',
      tags: ['governance', 'anchor'],
    },
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.28 },
      { tier: 2, threshold: 5, rarity: 0.58 },
      { tier: 3, threshold: 20, rarity: 0.86 },
    ],
  },
  {
    code: 'chronicle_spotlight',
    name: 'Chronicle Spotlight',
    category: 'spotlight_arc',
    triggerMode: 'daily',
    triggerSignals: ['batch_daily'],
    metric: 'public_entries',
    cooldownMs: 24 * 60 * 60 * 1000,
    evidencePolicy: { requiredKinds: ['chronicle'], maxEvidence: 3 },
    chronicleTemplate: {
      titlePrefix: 'Spotlight Presence',
      summary: 'Sustained high-signal public milestones without flooding the board.',
      tags: ['chronicle', 'spotlight'],
    },
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.2 },
      { tier: 2, threshold: 5, rarity: 0.52 },
      { tier: 3, threshold: 20, rarity: 0.8 },
    ],
  },
  {
    code: 'daily_presence',
    name: 'Daily Presence',
    category: 'continuity_arc',
    triggerMode: 'daily',
    triggerSignals: ['batch_daily'],
    metric: 'activity_days',
    cooldownMs: 24 * 60 * 60 * 1000,
    evidencePolicy: { requiredKinds: ['activity'], maxEvidence: 7 },
    chronicleTemplate: {
      titlePrefix: 'Continuity Keeper',
      summary: 'Kept daily continuity so arcs did not collapse between episodes.',
      tags: ['continuity', 'cadence'],
    },
    tiers: [
      { tier: 1, threshold: 1, rarity: 0.2 },
      { tier: 2, threshold: 7, rarity: 0.56 },
      { tier: 3, threshold: 30, rarity: 0.84 },
    ],
  },
  {
    code: 'cross_scene_actor',
    name: 'Cross Scene Actor',
    category: 'bridge_arc',
    triggerMode: 'weekly',
    triggerSignals: ['batch_weekly'],
    metric: 'cross_scene',
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
    evidencePolicy: { requiredKinds: ['cross_scene'], maxEvidence: 6 },
    chronicleTemplate: {
      titlePrefix: 'Scene Bridger',
      summary: 'Carried story energy across forum, relation, and private scenes.',
      tags: ['cross-scene', 'bridge'],
    },
    tiers: [
      { tier: 1, threshold: 2, rarity: 0.4 },
      { tier: 2, threshold: 4, rarity: 0.68 },
      { tier: 3, threshold: 6, rarity: 0.92 },
    ],
  },
  {
    code: 'milestone_story',
    name: 'Milestone Story',
    category: 'long_arc',
    triggerMode: 'weekly',
    triggerSignals: ['batch_weekly'],
    metric: 'chronicle_entries',
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
    evidencePolicy: { requiredKinds: ['chronicle'], maxEvidence: 5 },
    chronicleTemplate: {
      titlePrefix: 'Story Arc',
      summary: 'Reached a new long-arc milestone with durable, high-importance events.',
      tags: ['story', 'milestone'],
    },
    tiers: [
      { tier: 1, threshold: 3, rarity: 0.3 },
      { tier: 2, threshold: 15, rarity: 0.64 },
      { tier: 3, threshold: 40, rarity: 0.9 },
    ],
  },
]

export const ACHIEVEMENT_DEFINITIONS_V1: AchievementDefinition[] = groups.flatMap((group) => buildGroup(group))

if (ACHIEVEMENT_DEFINITIONS_V1.length !== 30) {
  throw new Error(`Expected 30 achievement definitions, got ${ACHIEVEMENT_DEFINITIONS_V1.length}`)
}

export function achievementPrerequisiteKey(code: string, tier: 1 | 2 | 3): string {
  return `${code}:tier${tier}`
}
