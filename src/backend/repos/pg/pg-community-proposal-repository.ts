import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  CommunityMergeRecommendation,
  CommunityProposal,
  CommunityProposalEvent,
  CreateCommunityProposalEventInput,
  CreateCommunityProposalInput,
  UpdateCommunityProposalInput,
  UpsertCommunityMergeRecommendationInput,
} from '../types.js'
import type { CommunityProposalRepository } from '../community-proposal-repository.js'
import {
  derivePublicationReviewProfileId,
  normalizeCommunityFamily,
  normalizePublicationReviewProfileId,
  resolveCommunityInteractionContract,
} from '../../../shared/semantic-taxonomy.js'

function toNullableJsonInput(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}

function toProposal(row: {
  id: string
  submittedByUserId: string
  name: string
  slugCandidate: string
  description: string
  premiseText: string
  targetAudience: string | null
  sceneTypes: string[]
  proposedCommunityFamily: string | null
  publicationReviewProfileId: string | null
  launchWave: string | null
  publicParticipationMode: string | null
  audienceSignalIngestion: string | null
  agentHumanResponseMode: string | null
  sourceCommunityId: string | null
  status: CommunityProposal['status']
  incubationVisibilityMode: CommunityProposal['incubation_visibility_mode']
  resultingCommunityId: string | null
  mergedIntoCommunityId: string | null
  reviewedByUserId: string | null
  reviewedAt: Date | null
  metaJson: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}): CommunityProposal {
  const proposedCommunityFamily =
    normalizeCommunityFamily(row.proposedCommunityFamily)
    ?? 'weekly_program'
  const publicationReviewProfileId =
    normalizePublicationReviewProfileId(row.publicationReviewProfileId)
    ?? derivePublicationReviewProfileId(proposedCommunityFamily)
  const interaction = resolveCommunityInteractionContract({
    public_participation_mode: row.publicParticipationMode,
    audience_signal_ingestion: row.audienceSignalIngestion,
    agent_human_response_mode: row.agentHumanResponseMode,
  })

  return {
    id: row.id,
    submitted_by_user_id: row.submittedByUserId,
    name: row.name,
    slug_candidate: row.slugCandidate,
    description: row.description,
    premise_text: row.premiseText,
    target_audience: row.targetAudience,
    scene_types: row.sceneTypes,
    proposed_community_family: proposedCommunityFamily,
    publication_review_profile_id: publicationReviewProfileId,
    launch_wave: row.launchWave,
    public_participation_mode: interaction.public_participation_mode,
    audience_signal_ingestion: interaction.audience_signal_ingestion,
    agent_human_response_mode: interaction.agent_human_response_mode,
    source_community_id: row.sourceCommunityId,
    status: row.status,
    incubation_visibility_mode: row.incubationVisibilityMode,
    resulting_community_id: row.resultingCommunityId,
    merged_into_community_id: row.mergedIntoCommunityId,
    reviewed_by_user_id: row.reviewedByUserId,
    reviewed_at: row.reviewedAt,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toRecommendation(row: {
  id: string
  proposalId: string
  duplicateOfCommunityId: string | null
  recommendedAsLaneCommunityId: string | null
  recommendedAsSeasonal: boolean
  incubationVisibilityMode: CommunityMergeRecommendation['incubation_visibility_mode'] | null
  overlapScore: number
  rationale: string[]
  metaJson: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}): CommunityMergeRecommendation {
  return {
    id: row.id,
    proposal_id: row.proposalId,
    duplicate_of_community_id: row.duplicateOfCommunityId,
    recommended_as_lane_community_id: row.recommendedAsLaneCommunityId,
    recommended_as_seasonal: row.recommendedAsSeasonal,
    incubation_visibility_mode: row.incubationVisibilityMode ?? 'GRAY',
    overlap_score: row.overlapScore,
    rationale: row.rationale,
    meta: row.metaJson as Record<string, unknown> | null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toEvent(row: {
  id: string
  proposalId: string
  actorType: CommunityProposalEvent['actor_type']
  actorId: string
  eventType: string
  payloadJson: Prisma.JsonValue | null
  createdAt: Date
}): CommunityProposalEvent {
  return {
    id: row.id,
    proposal_id: row.proposalId,
    actor_type: row.actorType,
    actor_id: row.actorId,
    event_type: row.eventType,
    payload_json: row.payloadJson as Record<string, unknown> | null,
    created_at: row.createdAt,
  }
}

export class PgCommunityProposalRepository implements CommunityProposalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createProposal(input: CreateCommunityProposalInput): Promise<CommunityProposal> {
    const interaction = resolveCommunityInteractionContract({
      public_participation_mode: input.public_participation_mode,
      audience_signal_ingestion: input.audience_signal_ingestion,
      agent_human_response_mode: input.agent_human_response_mode,
    })
    const row = await this.prisma.communityProposal.create({
      data: {
        id: randomUUID(),
        submittedByUserId: input.submitted_by_user_id,
        name: input.name,
        slugCandidate: input.slug_candidate,
        description: input.description,
        premiseText: input.premise_text,
        targetAudience: input.target_audience ?? null,
        sceneTypes: input.scene_types ?? [],
        proposedCommunityFamily: input.proposed_community_family,
        publicationReviewProfileId: input.publication_review_profile_id,
        launchWave: input.launch_wave ?? null,
        publicParticipationMode: interaction.public_participation_mode,
        audienceSignalIngestion: interaction.audience_signal_ingestion,
        agentHumanResponseMode: interaction.agent_human_response_mode,
        sourceCommunityId: input.source_community_id ?? null,
        status: input.status ?? 'SUBMITTED',
        incubationVisibilityMode: input.incubation_visibility_mode ?? null,
        resultingCommunityId: input.resulting_community_id ?? null,
        mergedIntoCommunityId: input.merged_into_community_id ?? null,
        reviewedByUserId: input.reviewed_by_user_id ?? null,
        reviewedAt: input.reviewed_at ?? null,
        metaJson: toNullableJsonInput(input.meta),
      },
    })
    return toProposal({ ...row, metaJson: row.metaJson })
  }

  async updateProposal(id: string, input: UpdateCommunityProposalInput): Promise<CommunityProposal | null> {
    const interaction =
      input.public_participation_mode !== undefined
      || input.audience_signal_ingestion !== undefined
      || input.agent_human_response_mode !== undefined
        ? resolveCommunityInteractionContract({
            public_participation_mode: input.public_participation_mode,
            audience_signal_ingestion: input.audience_signal_ingestion,
            agent_human_response_mode: input.agent_human_response_mode,
          })
        : null
    const row = await this.prisma.communityProposal.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.proposed_community_family !== undefined
          ? { proposedCommunityFamily: input.proposed_community_family }
          : {}),
        ...(input.publication_review_profile_id !== undefined
          ? { publicationReviewProfileId: input.publication_review_profile_id }
          : {}),
        ...(input.launch_wave !== undefined ? { launchWave: input.launch_wave } : {}),
        ...(interaction
          ? {
              publicParticipationMode: interaction.public_participation_mode,
              audienceSignalIngestion: interaction.audience_signal_ingestion,
              agentHumanResponseMode: interaction.agent_human_response_mode,
            }
          : {}),
        ...(input.incubation_visibility_mode !== undefined
          ? { incubationVisibilityMode: input.incubation_visibility_mode }
          : {}),
        ...(input.resulting_community_id !== undefined
          ? { resultingCommunityId: input.resulting_community_id }
          : {}),
        ...(input.merged_into_community_id !== undefined
          ? { mergedIntoCommunityId: input.merged_into_community_id }
          : {}),
        ...(input.reviewed_by_user_id !== undefined ? { reviewedByUserId: input.reviewed_by_user_id } : {}),
        ...(input.reviewed_at !== undefined ? { reviewedAt: input.reviewed_at } : {}),
        ...(input.meta !== undefined ? { metaJson: toNullableJsonInput(input.meta) } : {}),
      },
    }).catch((error) => (error?.code === 'P2025' ? null : Promise.reject(error)))
    return row ? toProposal({ ...row, metaJson: row.metaJson }) : null
  }

  async findProposalById(id: string): Promise<CommunityProposal | null> {
    const row = await this.prisma.communityProposal.findUnique({ where: { id } })
    return row ? toProposal({ ...row, metaJson: row.metaJson }) : null
  }

  async listProposals(opts?: { status?: CommunityProposal['status'] }): Promise<CommunityProposal[]> {
    const rows = await this.prisma.communityProposal.findMany({
      where: opts?.status ? { status: opts.status } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => toProposal({ ...row, metaJson: row.metaJson }))
  }

  async upsertRecommendation(
    input: UpsertCommunityMergeRecommendationInput,
  ): Promise<CommunityMergeRecommendation> {
    const row = await this.prisma.communityMergeRecommendation.upsert({
      where: { proposalId: input.proposal_id },
      update: {
        duplicateOfCommunityId: input.duplicate_of_community_id ?? null,
        recommendedAsLaneCommunityId: input.recommended_as_lane_community_id ?? null,
        recommendedAsSeasonal: input.recommended_as_seasonal ?? true,
        incubationVisibilityMode: input.incubation_visibility_mode ?? 'GRAY',
        overlapScore: input.overlap_score ?? 0,
        rationale: input.rationale ?? [],
        metaJson: toNullableJsonInput(input.meta),
      },
      create: {
        id: randomUUID(),
        proposalId: input.proposal_id,
        duplicateOfCommunityId: input.duplicate_of_community_id ?? null,
        recommendedAsLaneCommunityId: input.recommended_as_lane_community_id ?? null,
        recommendedAsSeasonal: input.recommended_as_seasonal ?? true,
        incubationVisibilityMode: input.incubation_visibility_mode ?? 'GRAY',
        overlapScore: input.overlap_score ?? 0,
        rationale: input.rationale ?? [],
        metaJson: toNullableJsonInput(input.meta),
      },
    })
    return toRecommendation({ ...row, metaJson: row.metaJson })
  }

  async findRecommendationByProposalId(proposalId: string): Promise<CommunityMergeRecommendation | null> {
    const row = await this.prisma.communityMergeRecommendation.findUnique({
      where: { proposalId },
    })
    return row ? toRecommendation({ ...row, metaJson: row.metaJson }) : null
  }

  async createEvent(input: CreateCommunityProposalEventInput): Promise<CommunityProposalEvent> {
    const row = await this.prisma.communityProposalEvent.create({
      data: {
        id: randomUUID(),
        proposalId: input.proposal_id,
        actorType: input.actor_type,
        actorId: input.actor_id,
        eventType: input.event_type,
        payloadJson: toNullableJsonInput(input.payload_json ?? null),
      },
    })
    return toEvent({ ...row, payloadJson: row.payloadJson })
  }

  async listEventsByProposalId(proposalId: string): Promise<CommunityProposalEvent[]> {
    const rows = await this.prisma.communityProposalEvent.findMany({
      where: { proposalId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => toEvent({ ...row, payloadJson: row.payloadJson }))
  }
}
