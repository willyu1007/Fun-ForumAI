import { InMemoryPostRepository } from '../repos/post-repository.js'
import { InMemoryCommentRepository } from '../repos/comment-repository.js'
import { InMemoryVoteRepository } from '../repos/vote-repository.js'
import { InMemoryHumanVoteRepository } from '../repos/human-vote-repository.js'
import { InMemoryHumanFollowRepository } from '../repos/human-follow-repository.js'
import { InMemoryMediaAssetRepository } from '../repos/media-asset-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import { InMemoryPostMediaRepository } from '../repos/post-media-repository.js'
import { InMemoryVisualDirectiveRepository } from '../repos/visual-directive-repository.js'
import { InMemoryImagePlanRepository } from '../repos/image-plan-repository.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../repos/agent-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import { InMemoryAgentSignalLogRepository } from '../repos/agent-signal-log-repository.js'
import { InMemoryCommunityRepository } from '../repos/community-repository.js'
import { InMemoryCommunityCultureDigestRepository } from '../repos/community-culture-digest-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from '../repos/event-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import { InMemoryRuntimeSceneStateRepository } from '../repos/runtime-scene-state-repository.js'
import { InMemoryRoomRepository } from '../repos/room-repository.js'
import { InMemoryRoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import { InMemoryAgentPublicProjectionRepository } from '../repos/agent-public-projection-repository.js'
import { InMemoryMessageRepository } from '../repos/message-repository.js'
import { InMemoryPublicSceneWriteRepository } from '../repos/public-scene-write-repository.js'
import { InMemoryStatsRepository } from '../repos/stats-repository.js'
import { InMemoryPersonaStateRepository } from '../repos/persona-state-repository.js'
import { InMemoryAchievementRepository } from '../repos/achievement-repository.js'
import { InMemoryChronicleRepository } from '../repos/chronicle-repository.js'
import { InMemoryPprSnapshotRepository } from '../repos/ppr-snapshot-repository.js'
import { InMemoryAgentStageTierSnapshotRepository } from '../repos/agent-stage-tier-snapshot-repository.js'
import { InMemoryIncubationRepository } from '../repos/incubation-repository.js'
import { InMemoryAudienceRepository } from '../repos/audience-repository.js'
import { InMemoryAftershowRunRepository } from '../repos/aftershow-run-repository.js'
import { InMemoryAftershowArtifactRepository } from '../repos/aftershow-artifact-repository.js'
import { InMemoryCommunityConfigRepository } from '../repos/community-config-repository.js'
import { InMemoryRoleAssignmentRepository } from '../repos/role-assignment-repository.js'
import { InMemoryNotificationRepository } from '../repos/notification-repository.js'
import { InMemoryUserRepository } from '../repos/user-repository.js'
import { InMemoryGuidanceActorStateRepository } from '../repos/guidance-state-repository.js'
import { InMemoryGuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import { InMemoryGuidanceEventLogRepository } from '../repos/guidance-event-log-repository.js'
import { InMemoryRiskGovernanceRepository } from '../repos/risk-governance-repository.js'

import type { PostRepository } from '../repos/post-repository.js'
import type { CommentRepository } from '../repos/comment-repository.js'
import type { VoteRepository } from '../repos/vote-repository.js'
import type { HumanVoteRepository } from '../repos/human-vote-repository.js'
import type { HumanFollowRepository } from '../repos/human-follow-repository.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { VisualDirectiveRepository } from '../repos/visual-directive-repository.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { AgentRepository, AgentConfigRepository } from '../repos/agent-repository.js'
import type { AgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import type { AgentSignalLogRepository } from '../repos/agent-signal-log-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { CommunityCultureDigestRepository } from '../repos/community-culture-digest-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { RuntimeSceneStateRepository } from '../repos/runtime-scene-state-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { AgentPublicProjectionRepository } from '../repos/agent-public-projection-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'
import type { PublicSceneWriteRepository } from '../repos/public-scene-write-repository.js'
import type { RelationRepository } from '../repos/relation-repository.js'
import type { StatsRepository } from '../repos/stats-repository.js'
import type { PersonaStateRepository } from '../repos/persona-state-repository.js'
import type { AchievementRepository } from '../repos/achievement-repository.js'
import type { ChronicleRepository } from '../repos/chronicle-repository.js'
import type { PprSnapshotRepository } from '../repos/ppr-snapshot-repository.js'
import type { AgentStageTierSnapshotRepository } from '../repos/agent-stage-tier-snapshot-repository.js'
import type { IncubationRepository } from '../repos/incubation-repository.js'
import type { AudienceRepository } from '../repos/audience-repository.js'
import type { AftershowRunRepository } from '../repos/aftershow-run-repository.js'
import type { AftershowArtifactRepository } from '../repos/aftershow-artifact-repository.js'
import type { CommunityConfigRepository } from '../repos/community-config-repository.js'
import type { RoleAssignmentRepository } from '../repos/role-assignment-repository.js'
import type { NotificationRepository } from '../repos/notification-repository.js'
import type { UserRepository } from '../repos/user-repository.js'
import type { GuidanceActorStateRepository } from '../repos/guidance-state-repository.js'
import type { GuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import type { GuidanceEventLogRepository } from '../repos/guidance-event-log-repository.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'

export interface Repositories {
  postRepo: PostRepository
  commentRepo: CommentRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  humanFollowRepo: HumanFollowRepository
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  postMediaRepo: PostMediaRepository
  visualDirectiveRepo: VisualDirectiveRepository
  imagePlanRepo: ImagePlanRepository
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  agentCommunityMembershipRepo: AgentCommunityMembershipRepository
  agentSignalLogRepo: AgentSignalLogRepository
  communityRepo: CommunityRepository
  communityCultureDigestRepo: CommunityCultureDigestRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  forumSceneMetadataRepo: ForumSceneMetadataRepository
  runtimeSceneStateRepo: RuntimeSceneStateRepository
  publicSceneWriteRepo: PublicSceneWriteRepository
  roomRepo: RoomRepository
  roomWatchabilityRepo: RoomWatchabilityRepository
  agentPublicProjectionRepo: AgentPublicProjectionRepository
  messageRepo: MessageRepository
  relationRepo: RelationRepository | null
  userRepo: UserRepository | null
  statsRepo: StatsRepository
  personaStateRepo: PersonaStateRepository
  achievementRepo: AchievementRepository
  chronicleRepo: ChronicleRepository
  pprSnapshotRepo: PprSnapshotRepository
  stageTierSnapshotRepo: AgentStageTierSnapshotRepository
  incubationRepo: IncubationRepository
  audienceRepo: AudienceRepository
  aftershowRunRepo: AftershowRunRepository
  aftershowArtifactRepo: AftershowArtifactRepository
  communityConfigRepo: CommunityConfigRepository
  roleAssignmentRepo: RoleAssignmentRepository
  notificationRepo: NotificationRepository | null
  guidanceActorStateRepo: GuidanceActorStateRepository
  guidanceInboxRepo: GuidanceInboxRepository
  guidanceEventLogRepo: GuidanceEventLogRepository
  riskGovernanceRepo: RiskGovernanceRepository
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
    const { PgMediaAssetRepository } = await import('../repos/pg/pg-media-asset-repository.js')
    const { PgMediaSemanticSnapshotRepository } = await import('../repos/pg/pg-media-semantic-snapshot-repository.js')
    const { PgSceneMediaBindingRepository } = await import('../repos/pg/pg-scene-media-binding-repository.js')
    const { PgMediaContextProjectionRepository } = await import('../repos/pg/pg-media-context-projection-repository.js')
    const { PgPostMediaRepository } = await import('../repos/pg/pg-post-media-repository.js')
    const { PgVisualDirectiveRepository } = await import('../repos/pg/pg-visual-directive-repository.js')
    const { PgImagePlanRepository } = await import('../repos/pg/pg-image-plan-repository.js')
    const { PgAgentRepository, PgAgentConfigRepository } = await import('../repos/pg/pg-agent-repository.js')
    const { PgAgentCommunityMembershipRepository } = await import('../repos/pg/pg-agent-community-membership-repository.js')
    const { PgAgentSignalLogRepository } = await import('../repos/pg/pg-agent-signal-log-repository.js')
    const { PgCommunityRepository } = await import('../repos/pg/pg-community-repository.js')
    const { PgCommunityCultureDigestRepository } = await import('../repos/pg/pg-community-culture-digest-repository.js')
    const { PgEventRepository, PgAgentRunRepository } = await import('../repos/pg/pg-event-repository.js')
    const { PgForumSceneMetadataRepository } = await import('../repos/pg/pg-forum-scene-metadata-repository.js')
    const { PgRuntimeSceneStateRepository } = await import('../repos/pg/pg-runtime-scene-state-repository.js')
    const { PgRoomRepository } = await import('../repos/pg/pg-room-repository.js')
    const { PgRoomWatchabilityRepository } = await import('../repos/pg/pg-room-watchability-repository.js')
    const { PgAgentPublicProjectionRepository } = await import('../repos/pg/pg-agent-public-projection-repository.js')
    const { PgMessageRepository } = await import('../repos/pg/pg-message-repository.js')
    const { PgUserRepository } = await import('../repos/pg/pg-user-repository.js')
    const { PgRelationRepository } = await import('../repos/pg/pg-relation-repository.js')
    const { PgStatsRepository } = await import('../repos/pg/pg-stats-repository.js')
    const { PgPersonaStateRepository } = await import('../repos/pg/pg-persona-state-repository.js')
    const { PgAchievementRepository } = await import('../repos/pg/pg-achievement-repository.js')
    const { PgChronicleRepository } = await import('../repos/pg/pg-chronicle-repository.js')
    const { PgPprSnapshotRepository } = await import('../repos/pg/pg-ppr-snapshot-repository.js')
    const { PgAgentStageTierSnapshotRepository } = await import('../repos/pg/pg-agent-stage-tier-snapshot-repository.js')
    const { PgIncubationRepository } = await import('../repos/pg/pg-incubation-repository.js')
    const { PgAudienceRepository } = await import('../repos/pg/pg-audience-repository.js')
    const { PgAftershowRunRepository } = await import('../repos/pg/pg-aftershow-run-repository.js')
    const { PgAftershowArtifactRepository } = await import('../repos/pg/pg-aftershow-artifact-repository.js')
    const { PgCommunityConfigRepository } = await import('../repos/pg/pg-community-config-repository.js')
    const { PgRoleAssignmentRepository } = await import('../repos/pg/pg-role-assignment-repository.js')
    const { PgNotificationRepository } = await import('../repos/pg/pg-notification-repository.js')
    const { PgGuidanceActorStateRepository } = await import('../repos/pg/pg-guidance-state-repository.js')
    const { PgGuidanceInboxRepository } = await import('../repos/pg/pg-guidance-inbox-repository.js')
    const { PgGuidanceEventLogRepository } = await import('../repos/pg/pg-guidance-event-log-repository.js')
    const { PgRiskGovernanceRepository } = await import('../repos/pg/pg-risk-governance-repository.js')
    const { PgPublicSceneWriteRepository } = await import('../repos/pg/pg-public-scene-write-repository.js')

    const pr = new PgPostRepository(prisma)
    const cr = new PgCommentRepository(prisma)
    const vr = new PgVoteRepository(prisma)
    const hvr = new PgHumanVoteRepository(prisma)
    const hfr = new PgHumanFollowRepository(prisma)
    const mar = new PgMediaAssetRepository(prisma)
    const msr = new PgMediaSemanticSnapshotRepository(prisma)
    const sbr = new PgSceneMediaBindingRepository(prisma)
    const mpr = new PgMediaContextProjectionRepository(prisma)
    const pmr = new PgPostMediaRepository(prisma)
    const vdr = new PgVisualDirectiveRepository(prisma)
    const ipr = new PgImagePlanRepository(prisma)
    const ar = new PgAgentRepository(prisma)
    const acr = new PgAgentConfigRepository(prisma)
    const amr = new PgAgentCommunityMembershipRepository(prisma)
    const aslr = new PgAgentSignalLogRepository(prisma)
    const cmr = new PgCommunityRepository(prisma)
    const cdr = new PgCommunityCultureDigestRepository(prisma)
    const er = new PgEventRepository(prisma)
    const arr = new PgAgentRunRepository(prisma)
    const forumSceneMetadataRepo = new PgForumSceneMetadataRepository(prisma)
    const runtimeSceneStateRepo = new PgRuntimeSceneStateRepository(prisma)
    const rr = new PgRoomRepository(prisma)
    const rwr = new PgRoomWatchabilityRepository(prisma)
    const appr = new PgAgentPublicProjectionRepository(prisma)
    const mr = new PgMessageRepository(prisma)
    const relr = new PgRelationRepository(prisma)
    const sr = new PgStatsRepository(prisma)
    const psr = new PgPersonaStateRepository(prisma)
    const achar = new PgAchievementRepository(prisma)
    const chr = new PgChronicleRepository(prisma)
    const ppr = new PgPprSnapshotRepository(prisma)
    const stageTier = new PgAgentStageTierSnapshotRepository(prisma)
    const incRepo = new PgIncubationRepository(prisma)
    const audRepo = new PgAudienceRepository(prisma)
    const aftershowRepo = new PgAftershowRunRepository(prisma)
    const aftershowArtifactRepo = new PgAftershowArtifactRepository(prisma)
    const communityConfigRepo = new PgCommunityConfigRepository(prisma)
    const roleAssignmentRepo = new PgRoleAssignmentRepository(prisma)
    const notificationRepo = new PgNotificationRepository(prisma)
    const guidanceActorStateRepo = new PgGuidanceActorStateRepository(prisma)
    const guidanceInboxRepo = new PgGuidanceInboxRepository(prisma)
    const guidanceEventLogRepo = new PgGuidanceEventLogRepository(prisma)
    const riskGovernanceRepo = new PgRiskGovernanceRepository(prisma)
    const publicSceneWriteRepo = new PgPublicSceneWriteRepository({
      prisma,
      eventRepo: er,
      agentRunRepo: arr,
    })

    hydratables.push(
      pr, cr, vr, hvr, hfr, pmr, ar, acr, amr, aslr, cmr, cdr, er, arr, forumSceneMetadataRepo, runtimeSceneStateRepo, rr, rwr, appr, mr,
      sr, achar, chr, ppr, stageTier, roleAssignmentRepo, psr,
    )

    return {
      repos: {
        postRepo: pr, commentRepo: cr, voteRepo: vr, humanVoteRepo: hvr,
        humanFollowRepo: hfr, mediaAssetRepo: mar,
        mediaSemanticSnapshotRepo: msr, sceneMediaBindingRepo: sbr,
        mediaContextProjectionRepo: mpr, postMediaRepo: pmr,
        visualDirectiveRepo: vdr, imagePlanRepo: ipr,
        agentRepo: ar, agentConfigRepo: acr, agentCommunityMembershipRepo: amr,
        agentSignalLogRepo: aslr, communityRepo: cmr, communityCultureDigestRepo: cdr,
        eventRepo: er, agentRunRepo: arr, forumSceneMetadataRepo, runtimeSceneStateRepo, publicSceneWriteRepo,
        roomRepo: rr, roomWatchabilityRepo: rwr, agentPublicProjectionRepo: appr, messageRepo: mr,
        relationRepo: relr, userRepo: new PgUserRepository(prisma),
        statsRepo: sr, personaStateRepo: psr, achievementRepo: achar, chronicleRepo: chr,
        pprSnapshotRepo: ppr, stageTierSnapshotRepo: stageTier,
        incubationRepo: incRepo, audienceRepo: audRepo, aftershowRunRepo: aftershowRepo,
        aftershowArtifactRepo, communityConfigRepo, roleAssignmentRepo,
        notificationRepo,
        guidanceActorStateRepo,
        guidanceInboxRepo,
        guidanceEventLogRepo,
        riskGovernanceRepo,
      },
      hydratables,
    }
  }

  const postRepo = new InMemoryPostRepository()
  const commentRepo = new InMemoryCommentRepository()
  const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
  const runtimeSceneStateRepo = new InMemoryRuntimeSceneStateRepository()
  const eventRepo = new InMemoryEventRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()

  return {
    repos: {
      postRepo,
      commentRepo,
      voteRepo: new InMemoryVoteRepository(),
      humanVoteRepo: new InMemoryHumanVoteRepository(),
      humanFollowRepo: new InMemoryHumanFollowRepository(),
      mediaAssetRepo: new InMemoryMediaAssetRepository(),
      mediaSemanticSnapshotRepo: new InMemoryMediaSemanticSnapshotRepository(),
      sceneMediaBindingRepo: new InMemorySceneMediaBindingRepository(),
      mediaContextProjectionRepo: new InMemoryMediaContextProjectionRepository(),
      postMediaRepo: new InMemoryPostMediaRepository(),
      visualDirectiveRepo: new InMemoryVisualDirectiveRepository(),
      imagePlanRepo: new InMemoryImagePlanRepository(),
      agentRepo: new InMemoryAgentRepository(),
      agentConfigRepo: new InMemoryAgentConfigRepository(),
      agentCommunityMembershipRepo: new InMemoryAgentCommunityMembershipRepository(),
      agentSignalLogRepo: new InMemoryAgentSignalLogRepository(),
      communityRepo: new InMemoryCommunityRepository(),
      communityCultureDigestRepo: new InMemoryCommunityCultureDigestRepository(),
      eventRepo,
      agentRunRepo,
      forumSceneMetadataRepo,
      runtimeSceneStateRepo,
      publicSceneWriteRepo: new InMemoryPublicSceneWriteRepository({
        postRepo,
        commentRepo,
        sceneMetadataRepo: forumSceneMetadataRepo,
        eventRepo,
        agentRunRepo,
      }),
      roomRepo: new InMemoryRoomRepository(),
      roomWatchabilityRepo: new InMemoryRoomWatchabilityRepository(),
      agentPublicProjectionRepo: new InMemoryAgentPublicProjectionRepository(),
      messageRepo: new InMemoryMessageRepository(),
      relationRepo: null,
      userRepo: new InMemoryUserRepository(),
      statsRepo: new InMemoryStatsRepository(),
      personaStateRepo: new InMemoryPersonaStateRepository(),
      achievementRepo: new InMemoryAchievementRepository(),
      chronicleRepo: new InMemoryChronicleRepository(),
      pprSnapshotRepo: new InMemoryPprSnapshotRepository(),
      stageTierSnapshotRepo: new InMemoryAgentStageTierSnapshotRepository(),
      incubationRepo: new InMemoryIncubationRepository(),
      audienceRepo: new InMemoryAudienceRepository(),
      aftershowRunRepo: new InMemoryAftershowRunRepository(),
      aftershowArtifactRepo: new InMemoryAftershowArtifactRepository(),
      communityConfigRepo: new InMemoryCommunityConfigRepository(),
      roleAssignmentRepo: new InMemoryRoleAssignmentRepository(),
      notificationRepo: new InMemoryNotificationRepository(),
      guidanceActorStateRepo: new InMemoryGuidanceActorStateRepository(),
      guidanceInboxRepo: new InMemoryGuidanceInboxRepository(),
      guidanceEventLogRepo: new InMemoryGuidanceEventLogRepository(),
      riskGovernanceRepo: new InMemoryRiskGovernanceRepository(),
    },
    hydratables,
  }
}
