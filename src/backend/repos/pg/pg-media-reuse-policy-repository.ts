import { Prisma, type MediaReusePolicyRecord as PrismaMediaReusePolicyRecord, type PrismaClient } from '@prisma/client'
import type {
  CreateMediaReusePolicyInput,
  MediaReusePolicy,
  MediaReusePolicySubjectType,
  VisualSourceKind,
} from '../types.js'
import type {
  MediaReusePolicyRepository,
  UpdateMediaReusePolicyPatch,
} from '../media-reuse-policy-repository.js'

export class PgMediaReusePolicyRepository implements MediaReusePolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMediaReusePolicyInput): Promise<MediaReusePolicy> {
    const row = await this.prisma.mediaReusePolicyRecord.create({
      data: this.toCreateData(input),
    })
    return this.toDomain(row)
  }

  async upsertBySubject(input: CreateMediaReusePolicyInput): Promise<MediaReusePolicy> {
    const row = await this.prisma.mediaReusePolicyRecord.upsert({
      where: {
        subjectType_subjectId_sourceKind: {
          subjectType: input.subject_type,
          subjectId: input.subject_id,
          sourceKind: input.source_kind,
        },
      },
      create: this.toCreateData(input),
      update: {
        communityId: input.community_id ?? null,
        stewardAgentId: input.steward_agent_id ?? null,
        allowedReuseModes: input.allowed_reuse_modes as unknown as Prisma.InputJsonValue,
        crossAgentQuoteAllowed: input.cross_agent_quote_allowed ?? false,
        discloseOriginPolicy: input.disclose_origin_policy,
        copyrightState: input.copyright_state,
        status: input.status ?? 'active',
        revokedAt: input.revoked_at ?? null,
        revokedReason: input.revoked_reason ?? null,
      },
    })
    return this.toDomain(row)
  }

  async findById(id: string): Promise<MediaReusePolicy | null> {
    const row = await this.prisma.mediaReusePolicyRecord.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findBySubject(
    subjectType: MediaReusePolicySubjectType,
    subjectId: string,
    sourceKind: VisualSourceKind,
  ): Promise<MediaReusePolicy | null> {
    const row = await this.prisma.mediaReusePolicyRecord.findUnique({
      where: {
        subjectType_subjectId_sourceKind: {
          subjectType,
          subjectId,
          sourceKind,
        },
      },
    })
    return row ? this.toDomain(row) : null
  }

  async update(id: string, patch: UpdateMediaReusePolicyPatch): Promise<MediaReusePolicy | null> {
    const row = await this.prisma.mediaReusePolicyRecord.update({
      where: { id },
      data: {
        ...(patch.allowed_reuse_modes !== undefined
          ? { allowedReuseModes: patch.allowed_reuse_modes as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.cross_agent_quote_allowed !== undefined
          ? { crossAgentQuoteAllowed: patch.cross_agent_quote_allowed }
          : {}),
        ...(patch.disclose_origin_policy !== undefined
          ? { discloseOriginPolicy: patch.disclose_origin_policy }
          : {}),
        ...(patch.copyright_state !== undefined ? { copyrightState: patch.copyright_state } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.revoked_at !== undefined ? { revokedAt: patch.revoked_at } : {}),
        ...(patch.revoked_reason !== undefined ? { revokedReason: patch.revoked_reason } : {}),
        ...(patch.community_id !== undefined ? { communityId: patch.community_id } : {}),
        ...(patch.steward_agent_id !== undefined ? { stewardAgentId: patch.steward_agent_id } : {}),
      },
    }).catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null
      }
      throw err
    })
    return row ? this.toDomain(row) : null
  }

  private toCreateData(input: CreateMediaReusePolicyInput): Prisma.MediaReusePolicyRecordUncheckedCreateInput {
    return {
      ...(input.id ? { id: input.id } : {}),
      subjectType: input.subject_type,
      subjectId: input.subject_id,
      sourceKind: input.source_kind,
      communityId: input.community_id ?? null,
      stewardAgentId: input.steward_agent_id ?? null,
      allowedReuseModes: input.allowed_reuse_modes as unknown as Prisma.InputJsonValue,
      crossAgentQuoteAllowed: input.cross_agent_quote_allowed ?? false,
      discloseOriginPolicy: input.disclose_origin_policy,
      copyrightState: input.copyright_state,
      status: input.status ?? 'active',
      revokedAt: input.revoked_at ?? null,
      revokedReason: input.revoked_reason ?? null,
    }
  }

  private toDomain(row: PrismaMediaReusePolicyRecord): MediaReusePolicy {
    return {
      id: row.id,
      subject_type: row.subjectType as MediaReusePolicy['subject_type'],
      subject_id: row.subjectId,
      source_kind: row.sourceKind as MediaReusePolicy['source_kind'],
      community_id: row.communityId,
      steward_agent_id: row.stewardAgentId,
      allowed_reuse_modes: row.allowedReuseModes as MediaReusePolicy['allowed_reuse_modes'],
      cross_agent_quote_allowed: row.crossAgentQuoteAllowed,
      disclose_origin_policy: row.discloseOriginPolicy as MediaReusePolicy['disclose_origin_policy'],
      copyright_state: row.copyrightState as MediaReusePolicy['copyright_state'],
      status: row.status as MediaReusePolicy['status'],
      revoked_at: row.revokedAt,
      revoked_reason: row.revokedReason,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
