import { ForumReadService } from '../services/forum-read-service.js'
import { ForumWriteService } from '../services/forum-write-service.js'
import { AgentService } from '../services/agent-service.js'
import { AgentCommunityMembershipService } from '../services/agent-community-membership-service.js'
import { GlobalHighlightsService } from '../services/global-highlights-service.js'
import { CommunityCultureDigestService } from '../services/community-culture-digest-service.js'
import { GovernanceAdapter } from '../services/governance-adapter.js'
import { HumanParticipationService } from '../services/human-participation-service.js'
import { ChatService } from '../services/chat-service.js'
import { AuthService } from '../services/auth-service.js'
import { StatsService } from '../services/stats-service.js'
import { PersonaStateService } from '../services/persona-state-service.js'
import { AchievementChronicleService } from '../services/achievement-chronicle-service.js'
import { AchievementsOrchestrator } from '../services/achievements-orchestrator.js'
import { AgentStageTierService } from '../services/agent-stage-tier-service.js'
import { RoomLifecycleManager } from '../services/room-lifecycle.js'
import { ConversationClock } from '../services/conversation-clock.js'
import { RoomProjector } from '../services/room-projector.js'
import { ChatroomRuntimeContextBuilder } from '../services/chatroom-runtime-context-builder.js'
import { RoomProgramStateLoader } from '../services/room-program-state-loader.js'
import { RoomCuePlanner } from '../services/room-cue-planner.js'
import { RoomProgramScorer } from '../services/room-program-scorer.js'
import { RoomProgramEngine } from '../services/room-program-engine.js'
import { RoomProgramProjector } from '../services/room-program-projector.js'
import { AgentPublicProjectionService } from '../services/agent-public-projection-service.js'
import { ChatroomControlService } from '../services/chatroom-control-service.js'
import { RoomDiscoveryService } from '../services/room-discovery-service.js'
import { RoomEcologyService } from '../services/room-ecology-service.js'
import { ChatroomCanonizationService } from '../services/chatroom-canonization-service.js'
import { IncubationService } from '../services/incubation-service.js'
import { IncubationOrchestrator } from '../services/incubation-orchestrator.js'
import { AudienceService } from '../services/audience-service.js'
import { AftershowService } from '../services/aftershow-service.js'
import { CommunityConfigService } from '../services/community-config-service.js'
import { RoleAssignmentService } from '../services/role-assignment-service.js'
import { SafeReplyService } from '../services/safe-reply-service.js'
import { HotTopicPolicyService } from '../services/hot-topic-policy-service.js'
import { ReviewService } from '../services/review-service.js'
import { RiskEventService } from '../services/risk-event-service.js'
import { IdentityGateService } from '../services/identity-gate-service.js'
import { PolicyGatewayService } from '../services/policy-gateway-service.js'
import { AgentConfigLintService } from '../services/agent-config-lint-service.js'
import { ComplaintAppealService } from '../services/complaint-appeal-service.js'
import { NotificationService } from '../services/notification-service.js'
import type { ModerationService } from '../moderation/moderation-service.js'
import type { SseHub } from '../sse/hub.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import type { LeaderElector } from '../runtime/leader-elector.js'
import type { Repositories } from './repos.js'

export function createCoreServices(deps: {
  repos: Repositories
  sseHub: SseHub
  moderator: ModerationService
  llmGateway: LLMGateway
  roomLifecycleLeaderElector: LeaderElector
  conversationClockLeaderElector: LeaderElector
}) {
  const { repos, sseHub, moderator, llmGateway } = deps

  const achievementChronicleService = new AchievementChronicleService({
    achievementRepo: repos.achievementRepo,
    chronicleRepo: repos.chronicleRepo,
    agentRepo: repos.agentRepo,
  })

  const safeReplyService = new SafeReplyService()
  const hotTopicPolicyService = new HotTopicPolicyService()
  const notificationService = repos.notificationRepo
    ? new NotificationService(repos.notificationRepo)
    : null
  const reviewService = new ReviewService(repos.riskGovernanceRepo, notificationService)
  const riskEventService = new RiskEventService(repos.riskGovernanceRepo, reviewService)
  const identityGateService = new IdentityGateService(repos.riskGovernanceRepo)
  const policyGatewayService = new PolicyGatewayService({
    moderator,
    safeReplyService,
    hotTopicPolicyService,
    riskEventService,
  })
  const agentConfigLintService = new AgentConfigLintService()
  const complaintAppealService = new ComplaintAppealService(repos.riskGovernanceRepo, reviewService, {
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
    messageRepo: repos.messageRepo,
    agentRepo: repos.agentRepo,
  }, notificationService)

  const forumReadService = new ForumReadService({
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
    voteRepo: repos.voteRepo,
    humanVoteRepo: repos.humanVoteRepo,
    postMediaRepo: repos.postMediaRepo,
    communityRepo: repos.communityRepo,
    agentRepo: repos.agentRepo,
    achievementChronicleService,
  })

  const stageTierService = new AgentStageTierService({
    achievementRepo: repos.achievementRepo,
    chronicleRepo: repos.chronicleRepo,
    snapshotRepo: repos.stageTierSnapshotRepo,
  })

  const incubationService = new IncubationService({
    incubationRepo: repos.incubationRepo,
  })

  const incubationOrchestrator = new IncubationOrchestrator({
    incubationRepo: repos.incubationRepo,
    membershipRepo: repos.agentCommunityMembershipRepo,
    communityRepo: repos.communityRepo,
    stageTierService,
  })

  const audienceService = new AudienceService({
    audienceRepo: repos.audienceRepo,
    postRepo: repos.postRepo,
  })

  const aftershowService = new AftershowService({
    postRepo: repos.postRepo,
    humanVoteRepo: repos.humanVoteRepo,
    audienceRepo: repos.audienceRepo,
    agentRepo: repos.agentRepo,
    communityRepo: repos.communityRepo,
    runRepo: repos.aftershowRunRepo,
    artifactRepo: repos.aftershowArtifactRepo,
    eventRepo: repos.eventRepo,
    notificationRepo: repos.notificationRepo,
  })

  const communityConfigService = new CommunityConfigService({
    communityRepo: repos.communityRepo,
    configRepo: repos.communityConfigRepo,
    eventRepo: repos.eventRepo,
  })

  const roleAssignmentService = new RoleAssignmentService({
    roleAssignmentRepo: repos.roleAssignmentRepo,
    communityRepo: repos.communityRepo,
    postRepo: repos.postRepo,
    agentRepo: repos.agentRepo,
    membershipRepo: repos.agentCommunityMembershipRepo,
    eventRepo: repos.eventRepo,
  })

  const forumWriteService = new ForumWriteService({
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
    voteRepo: repos.voteRepo,
    eventRepo: repos.eventRepo,
    agentRunRepo: repos.agentRunRepo,
    communityRepo: repos.communityRepo,
    membershipRepo: repos.agentCommunityMembershipRepo,
    roleAssignmentRepo: repos.roleAssignmentRepo,
    stageTierService,
    incubationRepo: repos.incubationRepo,
    moderator,
    policyGatewayService,
  })

  const globalHighlightsService = new GlobalHighlightsService({
    forumReadService,
    achievementChronicleService,
    chronicleRepo: repos.chronicleRepo,
  })

  const agentService = new AgentService({
    agentRepo: repos.agentRepo,
    agentConfigRepo: repos.agentConfigRepo,
    agentRunRepo: repos.agentRunRepo,
  })

  const agentCommunityMembershipService = new AgentCommunityMembershipService({
    membershipRepo: repos.agentCommunityMembershipRepo,
    agentRepo: repos.agentRepo,
    communityRepo: repos.communityRepo,
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
    eventRepo: repos.eventRepo,
  })

  const communityCultureDigestService = new CommunityCultureDigestService({
    digestRepo: repos.communityCultureDigestRepo,
    communityRepo: repos.communityRepo,
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
  })

  const statsService = new StatsService({
    statsRepo: repos.statsRepo,
    agentRepo: repos.agentRepo,
    agentService,
    xpService: null,
  })

  const personaStateService = new PersonaStateService({
    personaStateRepo: repos.personaStateRepo,
    agentService,
    statsService,
  })

  const agentPublicProjectionService = new AgentPublicProjectionService({
    projectionRepo: repos.agentPublicProjectionRepo,
    agentRepo: repos.agentRepo,
    agentService,
    relationRepo: repos.relationRepo,
    statsService,
    personaStateService,
    achievementChronicleService,
  })

  const chatService = new ChatService({
    roomRepo: repos.roomRepo,
    roomWatchabilityRepo: repos.roomWatchabilityRepo,
    messageRepo: repos.messageRepo,
    agentRepo: repos.agentRepo,
    agentService,
    sseHub,
    statsService,
    eventRepo: repos.eventRepo,
    policyGatewayService,
  })

  const roomProjector = new RoomProjector({
    roomRepo: repos.roomRepo,
    messageRepo: repos.messageRepo,
    agentRepo: repos.agentRepo,
    watchabilityRepo: repos.roomWatchabilityRepo,
    projectionService: agentPublicProjectionService,
  })

  const chatroomRuntimeContextBuilder = new ChatroomRuntimeContextBuilder({
    roomRepo: repos.roomRepo,
    agentRepo: repos.agentRepo,
    watchabilityRepo: repos.roomWatchabilityRepo,
    roomProjector,
    projectionService: agentPublicProjectionService,
  })

  const roomProgramStateLoader = new RoomProgramStateLoader({
    roomRepo: repos.roomRepo,
    messageRepo: repos.messageRepo,
    agentRepo: repos.agentRepo,
    watchabilityRepo: repos.roomWatchabilityRepo,
    projectionService: agentPublicProjectionService,
  })

  const roomCuePlanner = new RoomCuePlanner()
  const roomProgramScorer = new RoomProgramScorer()
  const roomDiscoveryService = new RoomDiscoveryService({
    roomRepo: repos.roomRepo,
    watchabilityRepo: repos.roomWatchabilityRepo,
  })
  const chatroomCanonizationService = new ChatroomCanonizationService({
    roomRepo: repos.roomRepo,
    watchabilityRepo: repos.roomWatchabilityRepo,
    chronicleService: achievementChronicleService,
    forumWriteService,
    sseHub,
  })
  const chatroomControlService = new ChatroomControlService({
    roomRepo: repos.roomRepo,
    watchabilityRepo: repos.roomWatchabilityRepo,
    agentRepo: repos.agentRepo,
    roomProjector,
    stateLoader: roomProgramStateLoader,
    scorer: roomProgramScorer,
    projectionService: agentPublicProjectionService,
    sseHub,
  })
  const roomEcologyService = new RoomEcologyService({
    roomRepo: repos.roomRepo,
    watchabilityRepo: repos.roomWatchabilityRepo,
    projectionService: agentPublicProjectionService,
    discoveryService: roomDiscoveryService,
    chatService,
    sseHub,
  })

  const roomProgramEngine = new RoomProgramEngine({
    stateLoader: roomProgramStateLoader,
    cuePlanner: roomCuePlanner,
    scorer: roomProgramScorer,
    watchabilityRepo: repos.roomWatchabilityRepo,
    sseHub,
  })

  const roomProgramProjector = new RoomProgramProjector({
    roomRepo: repos.roomRepo,
    messageRepo: repos.messageRepo,
    agentRepo: repos.agentRepo,
    watchabilityRepo: repos.roomWatchabilityRepo,
    roomProjector,
    canonizationService: chatroomCanonizationService,
    sseHub,
  })

  const roomLifecycle = new RoomLifecycleManager(
    repos.roomRepo,
    repos.roomWatchabilityRepo,
    sseHub,
    chatroomCanonizationService,
    deps.roomLifecycleLeaderElector,
  )

  const authService = repos.userRepo ? new AuthService(repos.userRepo) : null

  const governanceAdapter = new GovernanceAdapter({
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
    agentRepo: repos.agentRepo,
    messageRepo: repos.messageRepo,
    riskGovernanceRepo: repos.riskGovernanceRepo,
  })

  const humanParticipationService = new HumanParticipationService({
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
    voteRepo: repos.voteRepo,
    humanVoteRepo: repos.humanVoteRepo,
    humanFollowRepo: repos.humanFollowRepo,
    agentRepo: repos.agentRepo,
    agentConfigRepo: repos.agentConfigRepo,
    eventRepo: repos.eventRepo,
  })

  const achievementsOrchestrator = new AchievementsOrchestrator({
    agentRepo: repos.agentRepo,
    relationRepo: repos.relationRepo,
    achievementRepo: repos.achievementRepo,
    chronicleRepo: repos.chronicleRepo,
    signalLogRepo: repos.agentSignalLogRepo,
    chronicleService: achievementChronicleService,
  })

  const conversationClock = new ConversationClock({
    roomRepo: repos.roomRepo,
    messageRepo: repos.messageRepo,
    agentRepo: repos.agentRepo,
    agentService,
    chatService,
    llmGateway,
    sseHub,
    eventRepo: repos.eventRepo,
    agentRunRepo: repos.agentRunRepo,
    promptLayerService: null,
    promptOrchestrator: null,
    personaStateService,
    chatroomRuntimeContextBuilder,
    roomWatchabilityRepo: repos.roomWatchabilityRepo,
    roomProgramEngine,
    roomEcologyService,
    leaderElector: deps.conversationClockLeaderElector,
  })

  chatService.setRoomProjector(roomProjector)
  chatService.setRoomProgramProjector(roomProgramProjector)
  conversationClock.setChatroomRuntimeContextBuilder(chatroomRuntimeContextBuilder)
  chatroomControlService.setFastLaneHook(({ roomId, agentId }) =>
    conversationClock.prioritizeAgent(roomId, agentId)
  )

  chatService.setJoinHook((roomId, agentId, tick) => {
    conversationClock.onAgentJoined(roomId, agentId, tick)
  })
  chatService.setLeaveHook((roomId, agentId) => {
    conversationClock.onAgentLeft(roomId, agentId)
  })

  return {
    achievementChronicleService,
    forumReadService,
    stageTierService,
    incubationService,
    incubationOrchestrator,
    audienceService,
    aftershowService,
    communityConfigService,
    roleAssignmentService,
    forumWriteService,
    globalHighlightsService,
    agentService,
    agentCommunityMembershipService,
    communityCultureDigestService,
    statsService,
    personaStateService,
    agentPublicProjectionService,
    chatService,
    roomProjector,
    roomProgramStateLoader,
    roomCuePlanner,
    roomProgramScorer,
    roomDiscoveryService,
    roomEcologyService,
    chatroomCanonizationService,
    chatroomControlService,
    roomProgramEngine,
    roomProgramProjector,
    chatroomRuntimeContextBuilder,
    roomLifecycle,
    authService,
    governanceAdapter,
    notificationService,
    safeReplyService,
    hotTopicPolicyService,
    reviewService,
    riskEventService,
    identityGateService,
    policyGatewayService,
    complaintAppealService,
    agentConfigLintService,
    humanParticipationService,
    achievementsOrchestrator,
    conversationClock,
  }
}
