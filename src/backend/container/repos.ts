import type { PrismaClient } from '@prisma/client'
import { InMemoryPostRepository } from '../repos/post-repository.js'
import { InMemoryPublicStageThreadRepository } from '../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../repos/public-stage-turn-repository.js'
import { InMemoryVoteRepository } from '../repos/vote-repository.js'
import { InMemoryHumanVoteRepository } from '../repos/human-vote-repository.js'
import { InMemoryHumanFollowRepository } from '../repos/human-follow-repository.js'
import { InMemorySearchDocRepository } from '../repos/search-doc-repository.js'
import { InMemoryMediaAssetRepository } from '../repos/media-asset-repository.js'
import { InMemoryMediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import { InMemorySceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import { InMemoryPostMediaRepository } from '../repos/post-media-repository.js'
import { InMemoryDevSeedRegistryRepository } from '../repos/dev-seed-registry-repository.js'
import { InMemoryVisualDirectiveRepository } from '../repos/visual-directive-repository.js'
import { InMemoryImagePlanRepository } from '../repos/image-plan-repository.js'
import { InMemoryMediaReusePolicyRepository } from '../repos/media-reuse-policy-repository.js'
import { InMemoryMediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import { InMemoryMediaObservabilityEventRepository } from '../repos/media-observability-event-repository.js'
import { InMemoryMediaScenePackRepository } from '../repos/media-scene-pack-repository.js'
import { InMemoryMediaRolloutControllerOverrideRepository } from '../repos/media-rollout-controller-override-repository.js'
import { InMemoryMediaLineageEdgeRepository } from '../repos/media-lineage-edge-repository.js'
import { InMemoryMediaCatalogCardRepository } from '../repos/media-catalog-card-repository.js'
import { InMemoryMediaRetrievalDocumentRepository } from '../repos/media-retrieval-document-repository.js'
import { InMemoryMediaEmbeddingSnapshotRepository } from '../repos/media-embedding-snapshot-repository.js'
import { InMemoryMediaDuplicateClusterRepository } from '../repos/media-duplicate-cluster-repository.js'
import { InMemoryMediaImportJobRepository } from '../repos/media-import-job-repository.js'
import { InMemoryMediaImportJobItemRepository } from '../repos/media-import-job-item-repository.js'
import { InMemoryMediaRetrievalSearchRepository } from '../repos/media-retrieval-search-repository.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../repos/agent-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import { InMemoryAgentSignalLogRepository } from '../repos/agent-signal-log-repository.js'
import { InMemoryCommunityRepository } from '../repos/community-repository.js'
import { InMemoryCommunityCultureDigestRepository } from '../repos/community-culture-digest-repository.js'
import { InMemoryEventRepository, InMemoryAgentRunRepository } from '../repos/event-repository.js'
import { InMemoryForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import { InMemoryCueRepository } from '../repos/cue-repository.js'
import { InMemoryLoadSnapshotRepository } from '../repos/load-snapshot-repository.js'
import { InMemoryMediaPlanResolutionRepository } from '../repos/media-plan-resolution-repository.js'
import { InMemoryAutoEditorTriggerEventRepository } from '../repos/auto-editor-trigger-event-repository.js'
import { InMemoryRuntimeSceneStateRepository } from '../repos/runtime-scene-state-repository.js'
import { InMemoryRoomRepository } from '../repos/room-repository.js'
import { InMemoryRoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import { InMemoryAgentPublicProjectionRepository } from '../repos/agent-public-projection-repository.js'
import { InMemoryAgentBioRepository } from '../repos/agent-bio-repository.js'
import { InMemoryAgentBiographyRepository } from '../repos/agent-biography-repository.js'
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
import { InMemoryCommunityProposalRepository } from '../repos/community-proposal-repository.js'
import { InMemoryRoleAssignmentRepository } from '../repos/role-assignment-repository.js'
import { InMemoryNotificationRepository } from '../repos/notification-repository.js'
import { InMemoryFeedbackRepository } from '../repos/feedback-repository.js'
import { InMemoryUserRepository } from '../repos/user-repository.js'
import { InMemoryInviteCodeRepository } from '../repos/invite-code-repository.js'
import { InMemoryGuidanceActorStateRepository } from '../repos/guidance-state-repository.js'
import { InMemoryGuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import { InMemoryGuidanceEventLogRepository } from '../repos/guidance-event-log-repository.js'
import { InMemoryRiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import { InMemoryViewerPublicViewEventRepository } from '../repos/viewer-public-view-event-repository.js'
import { InMemoryWarmupGovernanceRepository } from '../repos/warmup-governance-repository.js'

import type { PostRepository } from '../repos/post-repository.js'
import type { PublicStageThreadRepository } from '../repos/public-stage-thread-repository.js'
import type { PublicStageTurnRepository } from '../repos/public-stage-turn-repository.js'
import type { VoteRepository } from '../repos/vote-repository.js'
import type { HumanVoteRepository } from '../repos/human-vote-repository.js'
import type { HumanFollowRepository } from '../repos/human-follow-repository.js'
import type { SearchDocRepository } from '../repos/search-doc-repository.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { DevSeedRegistryRepository } from '../repos/dev-seed-registry-repository.js'
import type { VisualDirectiveRepository } from '../repos/visual-directive-repository.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { MediaReusePolicyRepository } from '../repos/media-reuse-policy-repository.js'
import type { MediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import type { MediaObservabilityEventRepository } from '../repos/media-observability-event-repository.js'
import type { MediaScenePackRepository } from '../repos/media-scene-pack-repository.js'
import type { MediaRolloutControllerOverrideRepository } from '../repos/media-rollout-controller-override-repository.js'
import type { MediaLineageEdgeRepository } from '../repos/media-lineage-edge-repository.js'
import type { MediaCatalogCardRepository } from '../repos/media-catalog-card-repository.js'
import type { MediaRetrievalDocumentRepository } from '../repos/media-retrieval-document-repository.js'
import type { MediaEmbeddingSnapshotRepository } from '../repos/media-embedding-snapshot-repository.js'
import type { MediaDuplicateClusterRepository } from '../repos/media-duplicate-cluster-repository.js'
import type { MediaImportJobRepository } from '../repos/media-import-job-repository.js'
import type { MediaImportJobItemRepository } from '../repos/media-import-job-item-repository.js'
import type { MediaRetrievalSearchRepository } from '../repos/media-retrieval-search-repository.js'
import type { AgentRepository, AgentConfigRepository } from '../repos/agent-repository.js'
import type { AgentCommunityMembershipRepository } from '../repos/agent-community-membership-repository.js'
import type { AgentSignalLogRepository } from '../repos/agent-signal-log-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { CommunityCultureDigestRepository } from '../repos/community-culture-digest-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { CueRepository } from '../repos/cue-repository.js'
import type { LoadSnapshotRepository } from '../repos/load-snapshot-repository.js'
import type { MediaPlanResolutionRepository } from '../repos/media-plan-resolution-repository.js'
import type { AutoEditorTriggerEventRepository } from '../repos/auto-editor-trigger-event-repository.js'
import type { RuntimeSceneStateRepository } from '../repos/runtime-scene-state-repository.js'
import type { RoomRepository } from '../repos/room-repository.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { AgentPublicProjectionRepository } from '../repos/agent-public-projection-repository.js'
import type { AgentBioRepository } from '../repos/agent-bio-repository.js'
import type { AgentBiographyRepository } from '../repos/agent-biography-repository.js'
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
import type { CommunityProposalRepository } from '../repos/community-proposal-repository.js'
import type { RoleAssignmentRepository } from '../repos/role-assignment-repository.js'
import type { NotificationRepository } from '../repos/notification-repository.js'
import type { FeedbackRepository } from '../repos/feedback-repository.js'
import type { UserRepository } from '../repos/user-repository.js'
import type { InviteCodeRepository } from '../repos/invite-code-repository.js'
import type { GuidanceActorStateRepository } from '../repos/guidance-state-repository.js'
import type { GuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import type { GuidanceEventLogRepository } from '../repos/guidance-event-log-repository.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type { ViewerPublicViewEventRepository } from '../repos/viewer-public-view-event-repository.js'
import type { WarmupGovernanceRepository } from '../repos/warmup-governance-repository.js'

export interface Repositories {
  prisma: PrismaClient | null
  postRepo: PostRepository
  publicStageThreadRepo: PublicStageThreadRepository
  publicStageTurnRepo: PublicStageTurnRepository
  voteRepo: VoteRepository
  humanVoteRepo: HumanVoteRepository
  humanFollowRepo: HumanFollowRepository
  searchDocRepo: SearchDocRepository
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  postMediaRepo: PostMediaRepository
  devSeedRegistryRepo: DevSeedRegistryRepository
  visualDirectiveRepo: VisualDirectiveRepository
  imagePlanRepo: ImagePlanRepository
  mediaReusePolicyRepo: MediaReusePolicyRepository
  mediaGenerationJobRepo: MediaGenerationJobRepository
  mediaObservabilityEventRepo: MediaObservabilityEventRepository
  mediaScenePackRepo: MediaScenePackRepository
  mediaRolloutControllerOverrideRepo: MediaRolloutControllerOverrideRepository
  mediaLineageEdgeRepo: MediaLineageEdgeRepository
  mediaCatalogCardRepo: MediaCatalogCardRepository
  mediaRetrievalDocumentRepo: MediaRetrievalDocumentRepository
  mediaEmbeddingSnapshotRepo: MediaEmbeddingSnapshotRepository
  mediaRetrievalSearchRepo: MediaRetrievalSearchRepository
  mediaDuplicateClusterRepo: MediaDuplicateClusterRepository
  mediaImportJobRepo: MediaImportJobRepository
  mediaImportJobItemRepo: MediaImportJobItemRepository
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  agentCommunityMembershipRepo: AgentCommunityMembershipRepository
  agentSignalLogRepo: AgentSignalLogRepository
  communityRepo: CommunityRepository
  communityCultureDigestRepo: CommunityCultureDigestRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  forumSceneMetadataRepo: ForumSceneMetadataRepository
  cueRepo: CueRepository
  loadSnapshotRepo: LoadSnapshotRepository
  mediaPlanResolutionRepo: MediaPlanResolutionRepository
  autoEditorTriggerEventRepo: AutoEditorTriggerEventRepository
  runtimeSceneStateRepo: RuntimeSceneStateRepository
  publicSceneWriteRepo: PublicSceneWriteRepository
  roomRepo: RoomRepository
  roomWatchabilityRepo: RoomWatchabilityRepository
  agentPublicProjectionRepo: AgentPublicProjectionRepository
  agentBioRepo: AgentBioRepository
  agentBiographyRepo: AgentBiographyRepository
  messageRepo: MessageRepository
  relationRepo: RelationRepository | null
  userRepo: UserRepository | null
  inviteCodeRepo: InviteCodeRepository | null
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
  communityProposalRepo: CommunityProposalRepository
  roleAssignmentRepo: RoleAssignmentRepository
  notificationRepo: NotificationRepository | null
  feedbackRepo: FeedbackRepository
  guidanceActorStateRepo: GuidanceActorStateRepository
  guidanceInboxRepo: GuidanceInboxRepository
  guidanceEventLogRepo: GuidanceEventLogRepository
  riskGovernanceRepo: RiskGovernanceRepository
  viewerPublicViewEventRepo: ViewerPublicViewEventRepository
  warmupGovernanceRepo: WarmupGovernanceRepository
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
    const { PgPublicStageThreadRepository } = await import('../repos/pg/pg-public-stage-thread-repository.js')
    const { PgPublicStageTurnRepository } = await import('../repos/pg/pg-public-stage-turn-repository.js')
    const { PgVoteRepository } = await import('../repos/pg/pg-vote-repository.js')
    const { PgHumanVoteRepository } = await import('../repos/pg/pg-human-vote-repository.js')
    const { PgHumanFollowRepository } = await import('../repos/pg/pg-human-follow-repository.js')
    const { PgSearchDocRepository } = await import('../repos/pg/pg-search-doc-repository.js')
    const { PgMediaAssetRepository } = await import('../repos/pg/pg-media-asset-repository.js')
    const { PgMediaSemanticSnapshotRepository } = await import('../repos/pg/pg-media-semantic-snapshot-repository.js')
    const { PgSceneMediaBindingRepository } = await import('../repos/pg/pg-scene-media-binding-repository.js')
    const { PgMediaContextProjectionRepository } = await import('../repos/pg/pg-media-context-projection-repository.js')
    const { PgPostMediaRepository } = await import('../repos/pg/pg-post-media-repository.js')
    const { PgDevSeedRegistryRepository } = await import('../repos/pg/pg-dev-seed-registry-repository.js')
    const { PgVisualDirectiveRepository } = await import('../repos/pg/pg-visual-directive-repository.js')
    const { PgImagePlanRepository } = await import('../repos/pg/pg-image-plan-repository.js')
    const { PgMediaReusePolicyRepository } = await import('../repos/pg/pg-media-reuse-policy-repository.js')
    const { PgMediaGenerationJobRepository } = await import('../repos/pg/pg-media-generation-job-repository.js')
    const { PgMediaObservabilityEventRepository } = await import('../repos/pg/pg-media-observability-event-repository.js')
    const { PgMediaScenePackRepository } = await import('../repos/pg/pg-media-scene-pack-repository.js')
    const { PgMediaRolloutControllerOverrideRepository } = await import('../repos/pg/pg-media-rollout-controller-override-repository.js')
    const { PgMediaLineageEdgeRepository } = await import('../repos/pg/pg-media-lineage-edge-repository.js')
    const { PgMediaCatalogCardRepository } = await import('../repos/pg/pg-media-catalog-card-repository.js')
    const { PgMediaRetrievalDocumentRepository } = await import('../repos/pg/pg-media-retrieval-document-repository.js')
    const { PgMediaEmbeddingSnapshotRepository } = await import('../repos/pg/pg-media-embedding-snapshot-repository.js')
    const { PgMediaRetrievalSearchRepository } = await import('../repos/pg/pg-media-retrieval-search-repository.js')
    const { PgMediaDuplicateClusterRepository } = await import('../repos/pg/pg-media-duplicate-cluster-repository.js')
    const { PgMediaImportJobRepository } = await import('../repos/pg/pg-media-import-job-repository.js')
    const { PgMediaImportJobItemRepository } = await import('../repos/pg/pg-media-import-job-item-repository.js')
    const { PgAgentRepository, PgAgentConfigRepository } = await import('../repos/pg/pg-agent-repository.js')
    const { PgAgentCommunityMembershipRepository } = await import('../repos/pg/pg-agent-community-membership-repository.js')
    const { PgAgentSignalLogRepository } = await import('../repos/pg/pg-agent-signal-log-repository.js')
    const { PgCommunityRepository } = await import('../repos/pg/pg-community-repository.js')
    const { PgCommunityCultureDigestRepository } = await import('../repos/pg/pg-community-culture-digest-repository.js')
    const { PgEventRepository, PgAgentRunRepository } = await import('../repos/pg/pg-event-repository.js')
    const { PgForumSceneMetadataRepository } = await import('../repos/pg/pg-forum-scene-metadata-repository.js')
    const { PgCueRepository } = await import('../repos/pg/pg-cue-repository.js')
    const { PgLoadSnapshotRepository } = await import('../repos/pg/pg-load-snapshot-repository.js')
    const { PgMediaPlanResolutionRepository } = await import('../repos/pg/pg-media-plan-resolution-repository.js')
    const { PgAutoEditorTriggerEventRepository } = await import('../repos/pg/pg-auto-editor-trigger-event-repository.js')
    const { PgRuntimeSceneStateRepository } = await import('../repos/pg/pg-runtime-scene-state-repository.js')
    const { PgRoomRepository } = await import('../repos/pg/pg-room-repository.js')
    const { PgRoomWatchabilityRepository } = await import('../repos/pg/pg-room-watchability-repository.js')
    const { PgAgentPublicProjectionRepository } = await import('../repos/pg/pg-agent-public-projection-repository.js')
    const { PgAgentBioRepository } = await import('../repos/pg/pg-agent-bio-repository.js')
    const { PgAgentBiographyRepository } = await import('../repos/pg/pg-agent-biography-repository.js')
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
    const { PgCommunityProposalRepository } = await import('../repos/pg/pg-community-proposal-repository.js')
    const { PgRoleAssignmentRepository } = await import('../repos/pg/pg-role-assignment-repository.js')
    const { PgNotificationRepository } = await import('../repos/pg/pg-notification-repository.js')
    const { PgFeedbackRepository } = await import('../repos/pg/pg-feedback-repository.js')
    const { PgInviteCodeRepository } = await import('../repos/pg/pg-invite-code-repository.js')
    const { PgGuidanceActorStateRepository } = await import('../repos/pg/pg-guidance-state-repository.js')
    const { PgGuidanceInboxRepository } = await import('../repos/pg/pg-guidance-inbox-repository.js')
    const { PgGuidanceEventLogRepository } = await import('../repos/pg/pg-guidance-event-log-repository.js')
    const { PgRiskGovernanceRepository } = await import('../repos/pg/pg-risk-governance-repository.js')
    const { PgPublicSceneWriteRepository } = await import('../repos/pg/pg-public-scene-write-repository.js')
    const { PgViewerPublicViewEventRepository } = await import('../repos/pg/pg-viewer-public-view-event-repository.js')
    const { PgWarmupGovernanceRepository } =
      await import('../repos/pg/pg-warmup-governance-repository.js')

    const pr = new PgPostRepository(prisma)
    const publicStageThreadRepo = new PgPublicStageThreadRepository(prisma)
    const publicStageTurnRepo = new PgPublicStageTurnRepository(prisma)
    const vr = new PgVoteRepository(prisma)
    const hvr = new PgHumanVoteRepository(prisma)
    const hfr = new PgHumanFollowRepository(prisma)
    const searchDocRepo = new PgSearchDocRepository(prisma)
    const mar = new PgMediaAssetRepository(prisma)
    const msr = new PgMediaSemanticSnapshotRepository(prisma)
    const sbr = new PgSceneMediaBindingRepository(prisma)
    const mpr = new PgMediaContextProjectionRepository(prisma)
    const pmr = new PgPostMediaRepository(prisma)
    const dsrr = new PgDevSeedRegistryRepository(prisma)
    const vdr = new PgVisualDirectiveRepository(prisma)
    const ipr = new PgImagePlanRepository(prisma)
    const mrpr = new PgMediaReusePolicyRepository(prisma)
    const mgjr = new PgMediaGenerationJobRepository(prisma)
    const moer = new PgMediaObservabilityEventRepository(prisma)
    const mediaScenePackRepo = new PgMediaScenePackRepository(prisma)
    const mrcor = new PgMediaRolloutControllerOverrideRepository(prisma)
    const mler = new PgMediaLineageEdgeRepository(prisma)
    const mediaCatalogCardRepo = new PgMediaCatalogCardRepository(prisma)
    const mediaRetrievalDocumentRepo = new PgMediaRetrievalDocumentRepository(prisma)
    const mediaEmbeddingSnapshotRepo = new PgMediaEmbeddingSnapshotRepository(prisma)
    const mediaRetrievalSearchRepo = new PgMediaRetrievalSearchRepository(prisma)
    const mediaDuplicateClusterRepo = new PgMediaDuplicateClusterRepository(prisma)
    const mediaImportJobRepo = new PgMediaImportJobRepository(prisma)
    const mediaImportJobItemRepo = new PgMediaImportJobItemRepository(prisma)
    const ar = new PgAgentRepository(prisma)
    const acr = new PgAgentConfigRepository(prisma)
    const amr = new PgAgentCommunityMembershipRepository(prisma)
    const aslr = new PgAgentSignalLogRepository(prisma)
    const cmr = new PgCommunityRepository(prisma)
    const cdr = new PgCommunityCultureDigestRepository(prisma)
    const er = new PgEventRepository(prisma)
    const arr = new PgAgentRunRepository(prisma)
    const forumSceneMetadataRepo = new PgForumSceneMetadataRepository(prisma)
    const cueRepo = new PgCueRepository(prisma)
    const loadSnapshotRepo = new PgLoadSnapshotRepository(prisma)
    const mediaPlanResolutionRepo = new PgMediaPlanResolutionRepository(prisma)
    const autoEditorTriggerEventRepo = new PgAutoEditorTriggerEventRepository(prisma)
    const runtimeSceneStateRepo = new PgRuntimeSceneStateRepository(prisma)
    const rr = new PgRoomRepository(prisma)
    const rwr = new PgRoomWatchabilityRepository(prisma)
    const appr = new PgAgentPublicProjectionRepository(prisma)
    const abr = new PgAgentBioRepository(prisma)
    const agentBiographyRepo = new PgAgentBiographyRepository(prisma)
    const mr = new PgMessageRepository(prisma)
    const relr = new PgRelationRepository(prisma, {
      rememberEventPersisted: (event) => er.rememberPersisted(event),
    })
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
    const communityProposalRepo = new PgCommunityProposalRepository(prisma)
    const roleAssignmentRepo = new PgRoleAssignmentRepository(prisma)
    const notificationRepo = new PgNotificationRepository(prisma)
    const feedbackRepo = new PgFeedbackRepository(prisma)
    const guidanceActorStateRepo = new PgGuidanceActorStateRepository(prisma)
    const guidanceInboxRepo = new PgGuidanceInboxRepository(prisma)
    const guidanceEventLogRepo = new PgGuidanceEventLogRepository(prisma)
    const riskGovernanceRepo = new PgRiskGovernanceRepository(prisma)
    const viewerPublicViewEventRepo = new PgViewerPublicViewEventRepository(prisma)
    const warmupGovernanceRepo = new PgWarmupGovernanceRepository(prisma)
    const publicSceneWriteRepo = new PgPublicSceneWriteRepository({
      prisma,
      eventRepo: er,
      agentRunRepo: arr,
    })

    hydratables.push(
      pr, publicStageThreadRepo, publicStageTurnRepo, vr, hvr, hfr, pmr, ar, acr, amr, aslr, cmr, cdr, er, arr, forumSceneMetadataRepo, runtimeSceneStateRepo, rr, rwr, appr, abr, agentBiographyRepo, mr,
      sr, achar, chr, ppr, stageTier, roleAssignmentRepo, psr,
      warmupGovernanceRepo,
    )

    return {
      repos: {
        prisma,
        postRepo: pr, publicStageThreadRepo, publicStageTurnRepo, voteRepo: vr, humanVoteRepo: hvr,
        humanFollowRepo: hfr, searchDocRepo, mediaAssetRepo: mar,
        mediaSemanticSnapshotRepo: msr, sceneMediaBindingRepo: sbr,
        mediaContextProjectionRepo: mpr, postMediaRepo: pmr, devSeedRegistryRepo: dsrr,
        visualDirectiveRepo: vdr, imagePlanRepo: ipr,
        mediaReusePolicyRepo: mrpr, mediaGenerationJobRepo: mgjr,
        mediaObservabilityEventRepo: moer,
        mediaScenePackRepo,
        mediaRolloutControllerOverrideRepo: mrcor,
        mediaLineageEdgeRepo: mler,
        mediaCatalogCardRepo,
        mediaRetrievalDocumentRepo,
        mediaEmbeddingSnapshotRepo,
        mediaRetrievalSearchRepo,
        mediaDuplicateClusterRepo,
        mediaImportJobRepo,
        mediaImportJobItemRepo,
        agentRepo: ar, agentConfigRepo: acr, agentCommunityMembershipRepo: amr,
        agentSignalLogRepo: aslr, communityRepo: cmr, communityCultureDigestRepo: cdr,
        eventRepo: er, agentRunRepo: arr, forumSceneMetadataRepo, runtimeSceneStateRepo, publicSceneWriteRepo,
        cueRepo,
        loadSnapshotRepo,
        mediaPlanResolutionRepo,
        autoEditorTriggerEventRepo,
        roomRepo: rr, roomWatchabilityRepo: rwr, agentPublicProjectionRepo: appr, agentBioRepo: abr, agentBiographyRepo, messageRepo: mr,
        relationRepo: relr, userRepo: new PgUserRepository(prisma), inviteCodeRepo: new PgInviteCodeRepository(prisma),
        statsRepo: sr, personaStateRepo: psr, achievementRepo: achar, chronicleRepo: chr,
        pprSnapshotRepo: ppr, stageTierSnapshotRepo: stageTier,
        incubationRepo: incRepo, audienceRepo: audRepo, aftershowRunRepo: aftershowRepo,
        aftershowArtifactRepo, communityConfigRepo, communityProposalRepo, roleAssignmentRepo,
        notificationRepo,
        feedbackRepo,
        guidanceActorStateRepo,
        guidanceInboxRepo,
        guidanceEventLogRepo,
        riskGovernanceRepo,
        viewerPublicViewEventRepo,
        warmupGovernanceRepo,
      },
      hydratables,
    }
  }

  const postRepo = new InMemoryPostRepository()
  const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
  const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
  const forumSceneMetadataRepo = new InMemoryForumSceneMetadataRepository()
  const cueRepo = new InMemoryCueRepository()
  const loadSnapshotRepo = new InMemoryLoadSnapshotRepository()
  const mediaPlanResolutionRepo = new InMemoryMediaPlanResolutionRepository()
  const autoEditorTriggerEventRepo = new InMemoryAutoEditorTriggerEventRepository()
  const runtimeSceneStateRepo = new InMemoryRuntimeSceneStateRepository()
  const eventRepo = new InMemoryEventRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const userRepo = new InMemoryUserRepository()
  const mediaRetrievalDocumentRepo = new InMemoryMediaRetrievalDocumentRepository()
  const mediaEmbeddingSnapshotRepo = new InMemoryMediaEmbeddingSnapshotRepository()

  return {
    repos: {
      prisma: null,
      postRepo,
      publicStageThreadRepo,
      publicStageTurnRepo,
      voteRepo: new InMemoryVoteRepository(),
      humanVoteRepo: new InMemoryHumanVoteRepository(),
      humanFollowRepo: new InMemoryHumanFollowRepository(),
      searchDocRepo: new InMemorySearchDocRepository(),
      mediaAssetRepo: new InMemoryMediaAssetRepository(),
      mediaSemanticSnapshotRepo: new InMemoryMediaSemanticSnapshotRepository(),
      sceneMediaBindingRepo: new InMemorySceneMediaBindingRepository(),
      mediaContextProjectionRepo: new InMemoryMediaContextProjectionRepository(),
      postMediaRepo: new InMemoryPostMediaRepository(),
      devSeedRegistryRepo: new InMemoryDevSeedRegistryRepository(),
      visualDirectiveRepo: new InMemoryVisualDirectiveRepository(),
      imagePlanRepo: new InMemoryImagePlanRepository(),
      mediaReusePolicyRepo: new InMemoryMediaReusePolicyRepository(),
      mediaGenerationJobRepo: new InMemoryMediaGenerationJobRepository(),
      mediaObservabilityEventRepo: new InMemoryMediaObservabilityEventRepository(),
      mediaScenePackRepo: new InMemoryMediaScenePackRepository(),
      mediaRolloutControllerOverrideRepo: new InMemoryMediaRolloutControllerOverrideRepository(),
      mediaLineageEdgeRepo: new InMemoryMediaLineageEdgeRepository(),
      mediaCatalogCardRepo: new InMemoryMediaCatalogCardRepository(),
      mediaRetrievalDocumentRepo,
      mediaEmbeddingSnapshotRepo,
      mediaRetrievalSearchRepo: new InMemoryMediaRetrievalSearchRepository({
        listDocuments: () => mediaRetrievalDocumentRepo.listAll(),
        listSnapshots: () => mediaEmbeddingSnapshotRepo.listAll(),
      }),
      mediaDuplicateClusterRepo: new InMemoryMediaDuplicateClusterRepository(),
      mediaImportJobRepo: new InMemoryMediaImportJobRepository(),
      mediaImportJobItemRepo: new InMemoryMediaImportJobItemRepository(),
      agentRepo: new InMemoryAgentRepository(),
      agentConfigRepo: new InMemoryAgentConfigRepository(),
      agentCommunityMembershipRepo: new InMemoryAgentCommunityMembershipRepository(),
      agentSignalLogRepo: new InMemoryAgentSignalLogRepository(),
      communityRepo: new InMemoryCommunityRepository(),
      communityCultureDigestRepo: new InMemoryCommunityCultureDigestRepository(),
      eventRepo,
      agentRunRepo,
      forumSceneMetadataRepo,
      cueRepo,
      loadSnapshotRepo,
      mediaPlanResolutionRepo,
      autoEditorTriggerEventRepo,
      runtimeSceneStateRepo,
      publicSceneWriteRepo: new InMemoryPublicSceneWriteRepository({
        postRepo,
        publicStageThreadRepo,
        publicStageTurnRepo,
        sceneMetadataRepo: forumSceneMetadataRepo,
        eventRepo,
        agentRunRepo,
      }),
      roomRepo: new InMemoryRoomRepository(),
      roomWatchabilityRepo: new InMemoryRoomWatchabilityRepository(),
      agentPublicProjectionRepo: new InMemoryAgentPublicProjectionRepository(),
      agentBioRepo: new InMemoryAgentBioRepository(),
      agentBiographyRepo: new InMemoryAgentBiographyRepository(),
      messageRepo: new InMemoryMessageRepository(),
      relationRepo: null,
      userRepo,
      inviteCodeRepo: new InMemoryInviteCodeRepository(userRepo),
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
      communityProposalRepo: new InMemoryCommunityProposalRepository(),
      roleAssignmentRepo: new InMemoryRoleAssignmentRepository(),
      notificationRepo: new InMemoryNotificationRepository(),
      feedbackRepo: new InMemoryFeedbackRepository(),
      guidanceActorStateRepo: new InMemoryGuidanceActorStateRepository(),
      guidanceInboxRepo: new InMemoryGuidanceInboxRepository(),
      guidanceEventLogRepo: new InMemoryGuidanceEventLogRepository(),
      riskGovernanceRepo: new InMemoryRiskGovernanceRepository(),
      viewerPublicViewEventRepo: new InMemoryViewerPublicViewEventRepository(),
      warmupGovernanceRepo: new InMemoryWarmupGovernanceRepository(),
    },
    hydratables,
  }
}
