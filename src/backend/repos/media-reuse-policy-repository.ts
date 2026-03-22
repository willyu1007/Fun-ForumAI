import type {
  CreateMediaReusePolicyInput,
  MediaReusePolicy,
  MediaReusePolicySubjectType,
  VisualSourceKind,
} from './types.js'

export interface UpdateMediaReusePolicyPatch {
  allowed_reuse_modes?: MediaReusePolicy['allowed_reuse_modes']
  cross_agent_quote_allowed?: boolean
  disclose_origin_policy?: MediaReusePolicy['disclose_origin_policy']
  copyright_state?: MediaReusePolicy['copyright_state']
  status?: MediaReusePolicy['status']
  revoked_at?: Date | null
  revoked_reason?: string | null
  community_id?: string | null
  steward_agent_id?: string | null
}

export interface MediaReusePolicyRepository {
  create(input: CreateMediaReusePolicyInput): Promise<MediaReusePolicy>
  upsertBySubject(input: CreateMediaReusePolicyInput): Promise<MediaReusePolicy>
  findById(id: string): Promise<MediaReusePolicy | null>
  findBySubject(
    subjectType: MediaReusePolicySubjectType,
    subjectId: string,
    sourceKind: VisualSourceKind,
  ): Promise<MediaReusePolicy | null>
  update(id: string, patch: UpdateMediaReusePolicyPatch): Promise<MediaReusePolicy | null>
}

let counter = 0
function cuid(): string {
  return `media_reuse_policy_${Date.now()}_${++counter}`
}

function subjectKey(
  subjectType: MediaReusePolicySubjectType,
  subjectId: string,
  sourceKind: VisualSourceKind,
): string {
  return `${subjectType}:${subjectId}:${sourceKind}`
}

export class InMemoryMediaReusePolicyRepository implements MediaReusePolicyRepository {
  private readonly store = new Map<string, MediaReusePolicy>()
  private readonly subjectIndex = new Map<string, string>()

  async create(input: CreateMediaReusePolicyInput): Promise<MediaReusePolicy> {
    const now = new Date()
    const entity: MediaReusePolicy = {
      id: input.id ?? cuid(),
      subject_type: input.subject_type,
      subject_id: input.subject_id,
      source_kind: input.source_kind,
      community_id: input.community_id ?? null,
      steward_agent_id: input.steward_agent_id ?? null,
      allowed_reuse_modes: [...input.allowed_reuse_modes],
      cross_agent_quote_allowed: input.cross_agent_quote_allowed ?? false,
      disclose_origin_policy: input.disclose_origin_policy,
      copyright_state: input.copyright_state,
      status: input.status ?? 'active',
      revoked_at: input.revoked_at ?? null,
      revoked_reason: input.revoked_reason ?? null,
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    this.subjectIndex.set(
      subjectKey(entity.subject_type, entity.subject_id, entity.source_kind),
      entity.id,
    )
    return entity
  }

  async upsertBySubject(input: CreateMediaReusePolicyInput): Promise<MediaReusePolicy> {
    const existing = await this.findBySubject(
      input.subject_type,
      input.subject_id,
      input.source_kind,
    )
    if (!existing) {
      return this.create(input)
    }
    return (await this.update(existing.id, {
      allowed_reuse_modes: input.allowed_reuse_modes,
      cross_agent_quote_allowed: input.cross_agent_quote_allowed ?? existing.cross_agent_quote_allowed,
      disclose_origin_policy: input.disclose_origin_policy,
      copyright_state: input.copyright_state,
      status: input.status ?? existing.status,
      revoked_at: input.revoked_at ?? existing.revoked_at,
      revoked_reason: input.revoked_reason ?? existing.revoked_reason,
      community_id: input.community_id ?? existing.community_id,
      steward_agent_id: input.steward_agent_id ?? existing.steward_agent_id,
    })) ?? existing
  }

  async findById(id: string): Promise<MediaReusePolicy | null> {
    return this.store.get(id) ?? null
  }

  async findBySubject(
    subjectType: MediaReusePolicySubjectType,
    subjectId: string,
    sourceKind: VisualSourceKind,
  ): Promise<MediaReusePolicy | null> {
    const id = this.subjectIndex.get(subjectKey(subjectType, subjectId, sourceKind))
    return id ? (this.store.get(id) ?? null) : null
  }

  async update(id: string, patch: UpdateMediaReusePolicyPatch): Promise<MediaReusePolicy | null> {
    const current = this.store.get(id)
    if (!current) return null
    if (patch.allowed_reuse_modes !== undefined) current.allowed_reuse_modes = [...patch.allowed_reuse_modes]
    if (patch.cross_agent_quote_allowed !== undefined) {
      current.cross_agent_quote_allowed = patch.cross_agent_quote_allowed
    }
    if (patch.disclose_origin_policy !== undefined) {
      current.disclose_origin_policy = patch.disclose_origin_policy
    }
    if (patch.copyright_state !== undefined) current.copyright_state = patch.copyright_state
    if (patch.status !== undefined) current.status = patch.status
    if (patch.revoked_at !== undefined) current.revoked_at = patch.revoked_at
    if (patch.revoked_reason !== undefined) current.revoked_reason = patch.revoked_reason
    if (patch.community_id !== undefined) current.community_id = patch.community_id
    if (patch.steward_agent_id !== undefined) current.steward_agent_id = patch.steward_agent_id
    current.updated_at = new Date()
    return current
  }
}
