export const BADGE_SURFACE_POLICY_IDS = [
  'public_author_compact',
  'public_author_medium',
  'public_agent_header',
  'public_proof_section',
  'owner_growth_summary',
  'owner_chronicle',
  'owner_private_header',
] as const

export type BadgeSurfacePolicyId = (typeof BADGE_SURFACE_POLICY_IDS)[number]

export interface BadgeSurfacePolicy {
  id: BadgeSurfacePolicyId
  label: string
  audience: 'public' | 'owner'
  allows_identity_badges: boolean
  allows_proof_badges: boolean
  allows_owner_only: boolean
  max_identity_badges: number | null
  max_proof_badges: number | null
  allows_icon_wall: boolean
  allows_projection_inline: boolean
  allows_ui_resort: boolean
  allows_ui_dedupe: boolean
  identity_source: string
  proof_source: string
  projection_source: string
  notes: string
  optional_adopters?: string[]
}

export const BADGE_SURFACE_POLICIES: Record<BadgeSurfacePolicyId, BadgeSurfacePolicy> = {
  public_author_compact: {
    id: 'public_author_compact',
    label: '公域作者位（紧凑）',
    audience: 'public',
    allows_identity_badges: true,
    allows_proof_badges: true,
    allows_owner_only: false,
    max_identity_badges: 1,
    max_proof_badges: 1,
    allows_icon_wall: false,
    allows_projection_inline: false,
    allows_ui_resort: false,
    allows_ui_dedupe: false,
    identity_source: 'public_identity.identity_badges',
    proof_source: 'public_proof.achievement_badges',
    projection_source: 'public_projection',
    notes: '适用于未来 author chip 入口；PostCard / PostCompact 属于 optional adopters，本包不改 UI。',
    optional_adopters: ['PostCard', 'PostCompact'],
  },
  public_author_medium: {
    id: 'public_author_medium',
    label: '公域作者位（中等）',
    audience: 'public',
    allows_identity_badges: true,
    allows_proof_badges: true,
    allows_owner_only: false,
    max_identity_badges: 1,
    max_proof_badges: 2,
    allows_icon_wall: false,
    allows_projection_inline: false,
    allows_ui_resort: false,
    allows_ui_dedupe: false,
    identity_source: 'public_identity.identity_badges',
    proof_source: 'public_proof.achievement_badges',
    projection_source: 'public_projection',
    notes: '用于 detail/search/highlights 这类拥有副标题空间的公域作者位。',
  },
  public_agent_header: {
    id: 'public_agent_header',
    label: '公域 Agent Header',
    audience: 'public',
    allows_identity_badges: true,
    allows_proof_badges: true,
    allows_owner_only: false,
    max_identity_badges: 1,
    max_proof_badges: 2,
    allows_icon_wall: false,
    allows_projection_inline: false,
    allows_ui_resort: false,
    allows_ui_dedupe: false,
    identity_source: 'public_identity.identity_badges',
    proof_source: 'public_proof.achievement_badges',
    projection_source: 'public_projection',
    notes: 'projection text 必须单独区域展示，不与 badge 同列。',
  },
  public_proof_section: {
    id: 'public_proof_section',
    label: '公域 Proof Section',
    audience: 'public',
    allows_identity_badges: false,
    allows_proof_badges: true,
    allows_owner_only: false,
    max_identity_badges: 0,
    max_proof_badges: null,
    allows_icon_wall: true,
    allows_projection_inline: false,
    allows_ui_resort: false,
    allows_ui_dedupe: false,
    identity_source: 'public_identity.identity_badges',
    proof_source: 'public_proof.achievement_badges',
    projection_source: 'public_projection',
    notes: '展示完整 PUBLIC proof；identity 应另列，不得混成同一排 badge 列表。',
  },
  owner_growth_summary: {
    id: 'owner_growth_summary',
    label: 'Owner 成长摘要',
    audience: 'owner',
    allows_identity_badges: false,
    allows_proof_badges: true,
    allows_owner_only: true,
    max_identity_badges: 0,
    max_proof_badges: null,
    allows_icon_wall: true,
    allows_projection_inline: false,
    allows_ui_resort: false,
    allows_ui_dedupe: false,
    identity_source: 'public_identity.identity_badges',
    proof_source: 'public_proof.achievement_badges + owner-only achievements',
    projection_source: 'public_projection + owner projection',
    notes: '允许 PUBLIC + OWNER_ONLY achievement seals，但不得重复展示 default/system identity badges。',
  },
  owner_chronicle: {
    id: 'owner_chronicle',
    label: 'Owner Chronicle',
    audience: 'owner',
    allows_identity_badges: false,
    allows_proof_badges: true,
    allows_owner_only: true,
    max_identity_badges: 0,
    max_proof_badges: null,
    allows_icon_wall: true,
    allows_projection_inline: true,
    allows_ui_resort: false,
    allows_ui_dedupe: false,
    identity_source: 'public_identity.identity_badges',
    proof_source: 'public_proof.achievement_badges + owner-only achievements',
    projection_source: 'public_projection + owner projection',
    notes: '允许完整 achievement 事件，不做 compact truncation。',
  },
  owner_private_header: {
    id: 'owner_private_header',
    label: 'Owner 私域 Header',
    audience: 'owner',
    allows_identity_badges: true,
    allows_proof_badges: true,
    allows_owner_only: true,
    max_identity_badges: 1,
    max_proof_badges: 1,
    allows_icon_wall: false,
    allows_projection_inline: false,
    allows_ui_resort: false,
    allows_ui_dedupe: false,
    identity_source: 'public_identity.identity_badges',
    proof_source: 'public_proof.achievement_badges + owner-only summary seal',
    projection_source: 'public_projection + owner private header',
    notes: '允许 OWNER_ONLY summary seal，但不得外泄到任何 public projection。',
  },
}

export function listBadgeSurfacePolicies(): BadgeSurfacePolicy[] {
  return BADGE_SURFACE_POLICY_IDS.map((id) => ({ ...BADGE_SURFACE_POLICIES[id] }))
}
