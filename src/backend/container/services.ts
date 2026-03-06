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
import { AchievementChronicleService } from '../services/achievement-chronicle-service.js'
import { AchievementsOrchestrator } from '../services/achievements-orchestrator.js'
import { AgentStageTierService } from '../services/agent-stage-tier-service.js'
import { RoomLifecycleManager } from '../services/room-lifecycle.js'
import { ConversationClock } from '../services/conversation-clock.js'
import { IncubationService } from '../services/incubation-service.js'
import { IncubationOrchestrator } from '../services/incubation-orchestrator.js'
import { AudienceService } from '../services/audience-service.js'
import { AftershowService } from '../services/aftershow-service.js'
import { CommunityConfigService } from '../services/community-config-service.js'
import { RoleAssignmentService } from '../services/role-assignment-service.js'
import type { ModerationService } from '../moderation/moderation-service.js'
import type { SseHub } from '../sse/hub.js'
import type { LlmClient } from '../llm/llm-client.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { LeaderElector } from '../runtime/leader-elector.js'
import type { Repositories } from './repos.js'

export function createCoreServices(deps: {
  repos: Repositories
  sseHub: SseHub
  moderator: ModerationService
  llmClient: LlmClient
  promptEngine: PromptEngine
  roomLifecycleLeaderElector: LeaderElector
  conversationClockLeaderElector: LeaderElector
}) {
  const { repos, sseHub, moderator, llmClient, promptEngine } = deps

  const achievementChronicleService = new AchievementChronicleService({
    achievementRepo: repos.achievementRepo,
    chronicleRepo: repos.chronicleRepo,
    agentRepo: repos.agentRepo,
  })

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
    growthEngine: null,
  })

  const chatService = new ChatService({
    roomRepo: repos.roomRepo,
    messageRepo: repos.messageRepo,
    agentRepo: repos.agentRepo,
    agentService,
    sseHub,
    statsService,
    eventRepo: repos.eventRepo,
  })

  const roomLifecycle = new RoomLifecycleManager(repos.roomRepo, sseHub, deps.roomLifecycleLeaderElector)

  const authService = repos.userRepo ? new AuthService(repos.userRepo) : null

  const governanceAdapter = new GovernanceAdapter({
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
    agentRepo: repos.agentRepo,
  })

  const humanParticipationService = new HumanParticipationService({
    postRepo: repos.postRepo,
    commentRepo: repos.commentRepo,
    voteRepo: repos.voteRepo,
    humanVoteRepo: repos.humanVoteRepo,
    humanFollowRepo: repos.humanFollowRepo,
    agentRepo: repos.agentRepo,
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
    llmClient,
    promptEngine,
    sseHub,
    promptLayerService: null,
    promptOrchestrator: null,
    leaderElector: deps.conversationClockLeaderElector,
  })

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
    chatService,
    roomLifecycle,
    authService,
    governanceAdapter,
    humanParticipationService,
    achievementsOrchestrator,
    conversationClock,
  }
}
