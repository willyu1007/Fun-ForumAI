import { InMemoryPostRepository } from '../repos/post-repository.js'
import { InMemoryCommentRepository } from '../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../repos/vote-repository.js'
import { InMemoryHumanVoteRepository } from '../repos/human-vote-repository.js'
import { InMemoryHumanFollowRepository } from '../repos/human-follow-repository.js'
import { InMemoryInclinationAssetRepository } from '../repos/inclination-asset-repository.js'
import { InMemoryPostMediaRepository } from '../repos/post-media-repository.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../repos/agent-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import { InMemoryAgentSignalLogRepository } from '../repos/agent-signal-log-repository.js'
import { InMemoryCommunityRepository } from '../repos/community-repository.js'
import { InMemoryCommunityCultureDigestRepository } from '../repos/community-culture-digest-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from '../repos/event-repository.js'
import { InMemoryRoomRepository } from '../repos/room-repository.js'
import { InMemoryMessageRepository } from '../repos/message-repository.js'
import { InMemoryStatsRepository } from '../repos/stats-repository.js'
import { InMemoryAchievementRepository } from '../repos/achievement-repository.js'
import { InMemoryChronicleRepository } from '../repos/chronicle-repository.js'
import { InMemoryPprSnapshotRepository } from '../repos/ppr-snapshot-repository.js'
import { InMemoryAgentStageTierSnapshotRepository } from '../repos/agent-stage-tier-snapshot-repository.js'
import { InMemoryIncubationRepository } from '../repos/incubation-repository.js'
import { InMemoryAudienceRepository } from '../repos/audience-repository.js'
import { InMemoryAftershowRunRepository } from '../repos/aftershow-run-repository.js'

import type { PostRepository } from '../repos/post-repository.js'
import type { CommentRepository } from '../repos/comment-repository.js'
import type { VoteRepository } from '../repos/vote-repository.js'
import type { HumanVoteRepository } from '../repos/human-vote-repository.js'
import type { HumanFollowRepository } from '../repos/human-follow-repository.js'
import type { InclinationAssetRepository } from '../repos/inclination-asset-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { AgentRepository, AgentConfigRepository } from '../repos/agent-repository.js'
import type { AgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import type { AgentSignalLogRepository } from '../repos/agent-signal-log-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { CommunityCultureDigestRepository } from '../repos/community-culture-digest-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { RelationRepository } from '../repos/relation-repository.js'
import type { StatsRepository } from '../repos/stats-repository.js'
import type { AchievementRepository } from '../repos/achievement-repository.js'
import type { ChronicleRepository } from '../repos/chronicle-repository.js'
import type { PprSnapshotRepository } from '../repos/ppr-snapshot-repository.js'
import type { AgentStageTierSnapshotRepository } from '../repos/agent-stage-tier-snapshot-repository.js'
import type { IncubationRepository } from '../repos/incubation-repository.js'
import type { AudienceRepository } from '../repos/audience-repository.js'
import type { AftershowRunRepository } from '../repos/aftershow-run-repository.js'
import type { UserRepository } from '../repos/user-repository.js'

export interface Repositories {
  postRepo: PostRepository
  commentRepo: CommentRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  humanFollowRepo: HumanFollowRepository
  inclinationAssetRepo: InclinationAssetRepository
  postMediaRepo: PostMediaRepository
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  agentCommunityMembershipRepo: AgentCommunityMembershipRepository
  agentSignalLogRepo: AgentSignalLogRepository
  communityRepo: CommunityRepository
  communityCultureDigestRepo: CommunityCultureDigestRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  roomRepo: RoomRepository
  messageRepo: MessageRepository
  relationRepo: RelationRepository | null
  userRepo: UserRepository | null
  statsRepo: StatsRepository
  achievementRepo: AchievementRepository
  chronicleRepo: ChronicleRepository
  pprSnapshotRepo: PprSnapshotRepository
  stageTierSnapshotRepo: AgentStageTierSnapshotRepository
  incubationRepo: IncubationRepository
  audienceRepo: AudienceRepository
  aftershowRunRepo: AftershowRunRepository
}

interface HydratableRepo { hydrate(): Promise<void> }

export async function createRepositories(usePrisma: boolean): Promise<{
  repos: Repositories
  hydratables: HydratableRepo[]
}> {
  const hydratables: HydratableRepo[] = []

  if (usePrisma) {
    const { getPrismaClient } = await import('../persistence/prisma-client.js')
    const prisma = getPrismaClient()

    const { PgPostRepository } = await import('../repos/pg/pg-post-repository.js')
    const { PgCommentRepository } = await import('../repos/pg/pg-comment-repository.js')
    const { PgVoteRepository } = await import('../repos/pg/pg-vote-repository.js')
    const { PgHumanVoteRepository } = await import('../repos/pg/pg-human-vote-repository.js')
    const { PgHumanFollowRepository } = await import('../repos/pg/pg-human-follow-repository.js')
    const { PgInclinationAssetRepository } = await import('../repos/pg/pg-inclination-asset-repository.js')
    const { PgPostMediaRepository } = await import('../repos/pg/pg-post-media-repository.js')
    const { PgAgentRepository, PgAgentConfigRepository } = await import('../repos/pg/pg-agent-repository.js')
    const { PgAgentCommunityMembershipRepository } = await import('../repos/pg/pg-agent-community-membership-repository.js')
    const { PgAgentSignalLogRepository } = await import('../repos/pg/pg-agent-signal-log-repository.js')
    const { PgCommunityRepository } = await import('../repos/pg/pg-community-repository.js')
    const { PgCommunityCultureDigestRepository } = await import('../repos/pg/pg-community-culture-digest-repository.js')
    const { PgEventRepository, PgAgentRunRepository } = await import('../repos/pg/pg-event-repository.js')
    const { PgRoomRepository } = await import('../repos/pg/pg-room-repository.js')
    const { PgMessageRepository } = await import('../repos/pg/pg-message-repository.js')
    const { PgUserRepository } = await import('../repos/pg/pg-user-repository.js')
    const { PgRelationRepository } = await import('../repos/pg/pg-relation-repository.js')
    const { PgStatsRepository } = await import('../repos/pg/pg-stats-repository.js')
    const { PgAchievementRepository } = await import('../repos/pg/pg-achievement-repository.js')
    const { PgChronicleRepository } = await import('../repos/pg/pg-chronicle-repository.js')
    const { PgPprSnapshotRepository } = await import('../repos/pg/pg-ppr-snapshot-repository.js')
    const { PgAgentStageTierSnapshotRepository } = await import('../repos/pg/pg-agent-stage-tier-snapshot-repository.js')
    const { PgIncubationRepository } = await import('../repos/pg/pg-incubation-repository.js')
    const { PgAudienceRepository } = await import('../repos/pg/pg-audience-repository.js')
    const { PgAftershowRunRepository } = await import('../repos/pg/pg-aftershow-run-repository.js')

    const pr = new PgPostRepository(prisma)
    const cr = new PgCommentRepository(prisma)
    const vr = new PgVoteRepository(prisma)
    const hvr = new PgHumanVoteRepository(prisma)
    const hfr = new PgHumanFollowRepository(prisma)
    const iar = new PgInclinationAssetRepository(prisma)
    const pmr = new PgPostMediaRepository(prisma)
    const ar = new PgAgentRepository(prisma)
    const acr = new PgAgentConfigRepository(prisma)
    const amr = new PgAgentCommunityMembershipRepository(prisma)
    const aslr = new PgAgentSignalLogRepository(prisma)
    const cmr = new PgCommunityRepository(prisma)
    const cdr = new PgCommunityCultureDigestRepository(prisma)
    const er = new PgEventRepository(prisma)
    const arr = new PgAgentRunRepository(prisma)
    const rr = new PgRoomRepository(prisma)
    const mr = new PgMessageRepository(prisma)
    const relr = new PgRelationRepository(prisma)
    const sr = new PgStatsRepository(prisma)
    const achar = new PgAchievementRepository(prisma)
    const chr = new PgChronicleRepository(prisma)
    const ppr = new PgPprSnapshotRepository(prisma)
    const stageTier = new PgAgentStageTierSnapshotRepository(prisma)
    const incRepo = new PgIncubationRepository(prisma)
    const audRepo = new PgAudienceRepository(prisma)
    const aftershowRepo = new PgAftershowRunRepository(prisma)

    hydratables.push(pr, cr, vr, hvr, hfr, iar, pmr, ar, acr, amr, aslr, cmr, cdr, er, arr, rr, mr, sr, achar, chr, ppr, stageTier)

    return {
      repos: {
        postRepo: pr, commentRepo: cr, voteRepo: vr, humanVoteRepo: hvr,
        humanFollowRepo: hfr, inclinationAssetRepo: iar, postMediaRepo: pmr,
        agentRepo: ar, agentConfigRepo: acr, agentCommunityMembershipRepo: amr,
        agentSignalLogRepo: aslr, communityRepo: cmr, communityCultureDigestRepo: cdr,
        eventRepo: er, agentRunRepo: arr, roomRepo: rr, messageRepo: mr,
        relationRepo: relr, userRepo: new PgUserRepository(prisma),
        statsRepo: sr, achievementRepo: achar, chronicleRepo: chr,
        pprSnapshotRepo: ppr, stageTierSnapshotRepo: stageTier,
        incubationRepo: incRepo, audienceRepo: audRepo, aftershowRunRepo: aftershowRepo,
      },
      hydratables,
    }
  }

  return {
    repos: {
      postRepo: new InMemoryPostRepository(),
      commentRepo: new InMemoryCommentRepository(),
      voteRepo: new InMemoryVoteRepository(),
      humanVoteRepo: new InMemoryHumanVoteRepository(),
      humanFollowRepo: new InMemoryHumanFollowRepository(),
      inclinationAssetRepo: new InMemoryInclinationAssetRepository(),
      postMediaRepo: new InMemoryPostMediaRepository(),
      agentRepo: new InMemoryAgentRepository(),
      agentConfigRepo: new InMemoryAgentConfigRepository(),
      agentCommunityMembershipRepo: new InMemoryAgentCommunityMembershipRepository(),
      agentSignalLogRepo: new InMemoryAgentSignalLogRepository(),
      communityRepo: new InMemoryCommunityRepository(),
      communityCultureDigestRepo: new InMemoryCommunityCultureDigestRepository(),
      eventRepo: new InMemoryEventRepository(),
      agentRunRepo: new InMemoryAgentRunRepository(),
      roomRepo: new InMemoryRoomRepository(),
      messageRepo: new InMemoryMessageRepository(),
      relationRepo: null,
      userRepo: null,
      statsRepo: new InMemoryStatsRepository(),
      achievementRepo: new InMemoryAchievementRepository(),
      chronicleRepo: new InMemoryChronicleRepository(),
      pprSnapshotRepo: new InMemoryPprSnapshotRepository(),
      stageTierSnapshotRepo: new InMemoryAgentStageTierSnapshotRepository(),
      incubationRepo: new InMemoryIncubationRepository(),
      audienceRepo: new InMemoryAudienceRepository(),
      aftershowRunRepo: new InMemoryAftershowRunRepository(),
    },
    hydratables,
  }
}
