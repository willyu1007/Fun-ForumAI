import { isDeepStrictEqual } from 'node:util'
import type { PrismaClient } from '@prisma/client'
import { config } from '../lib/config.js'
import { sanitizeIdentityConfig } from '../identity/agent-identity.js'
import {
  agentBioRefreshService,
  agentCommunityMembershipService,
  agentConfigRepo,
  agentRepo,
  agentService,
  chatService,
  chatroomControlService,
  communityRepo,
  communityConfigRepo,
  devSeedRegistryRepo,
  guidanceBellService,
  guidanceOrchestrator,
  guidanceRecallScheduler,
  guidanceStateService,
  humanFollowRepo,
  mediaAssetRepo,
  mediaContextProjectionRepo,
  mediaSemanticSnapshotRepo,
  postMediaRepo,
  postRepo,
  publicStageThreadRepo,
  roomRepo,
  sceneMediaBindingRepo,
  searchProjectionService,
  userRepo,
  voteRepo,
} from '../container.js'
import type {
  Agent,
  Community,
  DevSeedProfile,
  Post,
  Room,
} from '../repos/types.js'
import { GUIDANCE_REASON_CODES } from '../guidance/reason-codes.js'
import {
  DEV_SEED_OWNER_IDS,
  DEV_SEED_PROACTIVE_TRIGGER_TYPE,
  getDevSeedFixtureSet,
  type DevSeedAgentSpec,
  type DevSeedFixtureSet,
  type DevSeedPostSpec,
  type DevSeedRoomSpec,
} from './dev-seed-fixtures.js'
import { buildFallbackMediaSemanticSummary } from '../media/media-semantic-service.js'
import type { LaunchSystemIdentityConfig } from '../launch/system-roster.js'

type SeededAgentRef = {
  id: string
  seed_key: string
  owner_id: string
  display_name: string
}

type DevSeedFixtureResult = {
  sessions: number
  messages: number
  notifications: number
}

type ActivityGuidanceFixtureResult = {
  follows: number
  inbox_items: number
  bell_items: number
}

export interface DevSeedRunResult {
  profile: DevSeedProfile
  counts: {
    communities: number
    agents: number
    posts: number
    threads: number
    rooms: number
    votes: number
    media: number
    private_sessions: number
    private_messages: number
    notifications: number
    follow_links: number
    guidance_inbox_items: number
    guidance_bell_items: number
  }
  ids: {
    communities: string[]
    agents: string[]
    posts: string[]
    threads: string[]
    rooms: string[]
  }
}

class RegistryTracker {
  private readonly seen = new Set<string>()

  constructor(private readonly profile: DevSeedProfile) {}

  async bind(seedKey: string, entityType: 'human_user' | 'community' | 'agent' | 'post' | 'thread' | 'room', entityId: string): Promise<void> {
    this.seen.add(seedKey)
    await devSeedRegistryRepo.upsert({
      profile: this.profile,
      seed_key: seedKey,
      entity_type: entityType,
      entity_id: entityId,
    })
  }

  async get(seedKey: string) {
    return devSeedRegistryRepo.get(this.profile, seedKey)
  }

  activeSeedKeys(): Set<string> {
    return new Set(this.seen)
  }
}

function buildDevSeedFixtureTimestamp(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
}

function compactSeedAgentIds(ids: Array<string | undefined>): string[] {
  return ids.filter((agentId): agentId is string => typeof agentId === 'string' && agentId.length > 0)
}

function isManagedSeedAgent(agent: Agent): boolean {
  return DEV_SEED_OWNER_IDS.includes(agent.owner_id as typeof DEV_SEED_OWNER_IDS[number])
}

async function getPrismaOrNull(): Promise<PrismaClient | null> {
  if (!config.db.usePrisma) return null
  const { getPrismaClient } = await import('../persistence/prisma-client.js')
  return getPrismaClient()
}

function findAgentByOwnerAndName(input: Pick<DevSeedAgentSpec, 'owner_id' | 'display_name'>): Agent | null {
  return agentRepo.findByOwner(input.owner_id)
    .filter((agent) => agent.display_name === input.display_name)
    .sort((left, right) => left.created_at.getTime() - right.created_at.getTime() || left.id.localeCompare(right.id))[0] ?? null
}

async function ensureSeedUsers(
  profile: DevSeedProfile,
  tracker: RegistryTracker,
): Promise<void> {
  if (!userRepo) return

  const fixtures = [
    { seed_key: 'human.dev-user-001', id: 'dev-user-001', email: 'dev-user-001@dev.local', role: 'user' as const },
    { seed_key: 'human.dev-admin-001', id: 'dev-admin-001', email: 'dev-admin-001@dev.local', role: 'admin' as const },
    { seed_key: 'human.dev-seed', id: 'dev-seed', email: 'dev-seed@dev.local', role: 'admin' as const },
    ...(profile === 'launch'
      ? [{
          seed_key: 'human.platform-system-owner',
          id: 'platform-system-owner',
          email: 'platform-system-owner@dev.local',
          role: 'admin' as const,
        }]
      : []),
  ]

  for (const fixture of fixtures) {
    const user = await userRepo.upsertDevIdentity({
      id: fixture.id,
      email: fixture.email,
      role: fixture.role,
    })
    await tracker.bind(fixture.seed_key, 'human_user', user.id)
  }
}

async function ensureSeedCommunity(
  spec: DevSeedFixtureSet['communities'][number],
  tracker: RegistryTracker,
): Promise<Community> {
  const registered = await tracker.get(spec.seed_key)
  let community = registered ? communityRepo.findById(registered.entity_id) : null
  if (!community) {
    community = communityRepo.findBySlug(spec.slug)
  }
  if (!community) {
    community = communityRepo.createPersisted
      ? await communityRepo.createPersisted(spec)
      : communityRepo.create(spec)
  } else if (
    community.name !== spec.name
    || (community.description ?? '') !== spec.description
    || !isDeepStrictEqual(community.rules_json ?? null, spec.rules_json)
  ) {
    community = communityRepo.update(community.id, {
      name: spec.name,
      description: spec.description,
      rules_json: spec.rules_json,
    }) ?? community
  }

  await tracker.bind(spec.seed_key, 'community', community.id)
  return community
}

async function ensureCommunityBaselineConfigVersion(
  community: Community,
  spec: DevSeedFixtureSet['communities'][number],
): Promise<void> {
  const latest = await communityConfigRepo.findLatestVersionByCommunity(community.id)
  if (
    latest
    && latest.status === 'ACTIVE'
    && isDeepStrictEqual(latest.rules_json, spec.rules_json)
  ) {
    return
  }

  if (latest && (latest.status === 'ACTIVE' || latest.status === 'RETIRED')) {
    await communityConfigRepo.updateVersion(latest.id, {
      status: 'RETIRED',
      meta: {
        ...(latest.meta ?? {}),
        retired_by: 'dev_seed_launch_baseline',
      },
    })
  }

  await communityConfigRepo.createVersion({
    community_id: community.id,
    version: (latest?.version ?? 0) + 1,
    rules_json: spec.rules_json,
    status: 'ACTIVE',
    risk_level: 'LOW',
    created_by_user_id: null,
    effective_at: new Date(),
    applied_at: new Date(),
    meta: {
      source: 'dev_seed_launch_baseline',
      seed_key: spec.seed_key,
    },
  })
}

async function ensureSeedIdentity(
  agentId: string,
  spec: Pick<DevSeedAgentSpec, 'persona_seed_code' | 'owner_style_pins' | 'config_patch'>,
): Promise<boolean> {
  const latestConfig = agentConfigRepo.findLatest(agentId)
  const normalizedDesired = sanitizeIdentityConfig({
    personaSeed: { seedCode: spec.persona_seed_code },
    ownerStylePins: spec.owner_style_pins,
    ...(spec.config_patch ?? {}),
  })
  const currentConfig = sanitizeIdentityConfig(latestConfig?.config_json ?? {})
  const currentIdentitySlice = {
    personaSeed: currentConfig.personaSeed ?? null,
    ownerStylePins: currentConfig.ownerStylePins ?? null,
    config_patch: spec.config_patch
      ? Object.fromEntries(Object.keys(spec.config_patch).map((key) => [key, currentConfig[key] ?? null]))
      : null,
  }
  const desiredIdentitySlice = {
    personaSeed: normalizedDesired.personaSeed ?? null,
    ownerStylePins: normalizedDesired.ownerStylePins ?? null,
    config_patch: spec.config_patch
      ? Object.fromEntries(Object.keys(spec.config_patch).map((key) => [key, normalizedDesired[key] ?? null]))
      : null,
  }
  if (isDeepStrictEqual(currentIdentitySlice, desiredIdentitySlice)) {
    return false
  }
  await agentService.updateConfig(agentId, desiredIdentitySlice, 'dev-seed', undefined, {
    suppress_hooks: true,
  })
  return true
}

async function ensureSeedAgent(
  spec: DevSeedAgentSpec,
  tracker: RegistryTracker,
): Promise<{
  agent: Agent
  identity_changed: boolean
}> {
  const registered = await tracker.get(spec.seed_key)
  let agent = registered ? agentRepo.findById(registered.entity_id) : null
  if (!agent) {
    agent = findAgentByOwnerAndName(spec)
  }
  if (!agent) {
    agent = await agentService.createAgentPersisted({
      owner_id: spec.owner_id,
      display_name: spec.display_name,
      model: spec.model,
      persona_seed_code: spec.persona_seed_code,
      owner_style_pins: spec.owner_style_pins,
      launch_system_identity: spec.config_patch?.launch_system_identity as LaunchSystemIdentityConfig | undefined,
    })
  }
  if (agent.display_name !== spec.display_name) {
    agent = agentRepo.updateProfile(agent.id, { display_name: spec.display_name }) ?? agent
  }
  const identityChanged = await ensureSeedIdentity(agent.id, spec)
  await tracker.bind(spec.seed_key, 'agent', agent.id)
  return {
    agent,
    identity_changed: identityChanged,
  }
}

async function findLegacyPostId(
  prisma: PrismaClient | null,
  communityId: string,
  title: string,
): Promise<string | null> {
  if (!prisma) return null
  const row = await prisma.post.findFirst({
    where: {
      communityId,
      title,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  return row?.id ?? null
}

async function ensureSeedPost(
  spec: DevSeedPostSpec,
  context: {
    community: Community
    agent: Agent
    tracker: RegistryTracker
    prisma: PrismaClient | null
  },
): Promise<Post> {
  const registered = await context.tracker.get(spec.seed_key)
  let post = registered ? await postRepo.findById(registered.entity_id) : null
  if (!post) {
    post = await postRepo.findById(spec.id)
  }
  if (!post) {
    const legacyId = await findLegacyPostId(context.prisma, context.community.id, spec.title)
    if (legacyId) {
      post = await postRepo.findById(legacyId)
    }
  }

  if (!post) {
    post = await postRepo.create({
      id: spec.id,
      community_id: context.community.id,
      author_agent_id: context.agent.id,
      title: spec.title,
      body: spec.body,
      tags: spec.tags,
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
  } else {
    post = await postRepo.updateContent(post.id, {
      community_id: context.community.id,
      author_agent_id: context.agent.id,
      title: spec.title,
      body: spec.body,
      tags: spec.tags,
      visibility: 'PUBLIC',
      state: 'APPROVED',
      moderation_metadata: null,
    }) ?? post
  }

  await context.tracker.bind(spec.seed_key, 'post', post.id)
  return post
}

async function rebuildSeedPostMedia(
  fixtures: DevSeedPostSpec[],
  postsBySeedKey: Map<string, Post>,
  agentsBySeedKey: Map<string, Agent>,
  prisma: PrismaClient | null,
): Promise<number> {
  let mediaCount = 0

  for (const postSpec of fixtures) {
    if (!postSpec.media || postSpec.media.length === 0) continue
    const post = postsBySeedKey.get(postSpec.seed_key)
    const author = agentsBySeedKey.get(postSpec.agent_seed_key)
    if (!post || !author) continue

    postMediaRepo.deleteByPostIds([post.id])
    const existingBindings = await sceneMediaBindingRepo.findByScene('forum_post', post.id)
    const bindingIds = existingBindings.map((item) => item.id)
    await mediaContextProjectionRepo.deleteByBindingIds(bindingIds)
    await sceneMediaBindingRepo.deleteByIds(bindingIds)

    for (let index = 0; index < postSpec.media.length; index += 1) {
      const media = postSpec.media[index]!
      const assetId = `seed-media-asset-${media.seed_key}`
      const snapshotId = `seed-media-snapshot-${media.seed_key}`
      const bindingId = `seed-media-binding-${media.seed_key}`
      const projectionId = `seed-media-projection-${media.seed_key}`

      if (prisma) {
        await prisma.mediaAsset.upsert({
          where: { id: assetId },
          update: {
            originUrl: media.url,
          },
          create: {
            id: assetId,
            sourceKind: 'url_import',
            visibilityPolicy: 'public_original_allowed',
            lifecycleStatus: 'active',
            originUrl: media.url,
            mimeType: media.mime,
            fileSizeBytes: 0,
            sha256: `seed-sha256-${media.seed_key}`,
          },
        })
        await prisma.mediaSemanticSnapshot.upsert({
          where: { id: snapshotId },
          update: {
            summaryJson: { alt_text: media.alt },
            isCurrent: true,
          },
          create: {
            id: snapshotId,
            assetId,
            snapshotKind: 'seed',
            schemaVersion: 'seed.v1',
            modelProvider: 'seed',
            modelName: 'seed',
            modelVersion: '1.0',
            summaryJson: { alt_text: media.alt },
            extractionStatus: 'completed',
            qualityGrade: 'rich',
            isCurrent: true,
          },
        })
      } else {
        const asset = await mediaAssetRepo.findById(assetId)
        if (!asset) {
          await mediaAssetRepo.create({
            id: assetId,
            source_kind: 'url_import',
            visibility_policy: 'public_original_allowed',
            lifecycle_status: 'active',
            mime_type: media.mime,
            file_size_bytes: 0,
            sha256: `seed-sha256-${media.seed_key}`,
            origin_url: media.url,
          })
        } else if (asset.origin_url !== media.url) {
          await mediaAssetRepo.update(asset.id, { origin_url: media.url })
        }
        const currentSnapshot = await mediaSemanticSnapshotRepo.findCurrentByAssetId(assetId)
        if (!currentSnapshot) {
          await mediaSemanticSnapshotRepo.create({
            id: snapshotId,
            asset_id: assetId,
            snapshot_kind: 'visual_core',
            schema_version: 'seed.v1',
            model_provider: 'seed',
            model_name: 'seed',
            model_version: '1.0',
            summary: buildFallbackMediaSemanticSummary(media.mime),
            extraction_status: 'completed',
            quality_grade: 'rich',
            is_current: true,
          })
        }
      }

      const binding = await sceneMediaBindingRepo.create({
        id: bindingId,
        scene_type: 'forum_post',
        scene_id: post.id,
        asset_id: assetId,
        semantic_snapshot_id: snapshotId,
        binding_role: 'primary',
        relation_to_scene: 'selected_for_post',
        display_policy: 'original_allowed',
        created_by_type: 'agent',
        created_by_id: author.id,
      })

      await mediaContextProjectionRepo.create({
        id: projectionId,
        binding_id: binding.id,
        projection_surface: 'public_display',
        projection_kind: 'display_attachment',
        schema_version: 'display_attachment.v1',
        payload_json: {
          asset_id: assetId,
          media_url: media.url,
          mime_type: media.mime,
          alt_text: media.alt,
          slot: index,
        },
      })

      postMediaRepo.create({
        post_id: post.id,
        asset_id: assetId,
        media_url: media.url,
        mime_type: media.mime,
      })
      mediaCount += 1
    }
  }

  return mediaCount
}

async function rebuildSeedThreads(
  profile: DevSeedProfile,
  fixtures: DevSeedFixtureSet['threads'],
  postsBySeedKey: Map<string, Post>,
  agentsBySeedKey: Map<string, Agent>,
  tracker: RegistryTracker,
): Promise<string[]> {
  const existingRegistryRows = await devSeedRegistryRepo.listByProfile(profile)
  const existingThreadRows = existingRegistryRows.filter((row) => row.entity_type === 'thread')

  for (const entry of existingThreadRows) {
    await publicStageThreadRepo.delete(entry.entity_id)
  }

  const threadIds: string[] = []
  for (const spec of fixtures) {
    const post = postsBySeedKey.get(spec.post_seed_key)
    const agent = agentsBySeedKey.get(spec.agent_seed_key)
    if (!post || !agent) continue

    const thread = await publicStageThreadRepo.create({
      id: spec.id,
      post_id: post.id,
      community_id: post.community_id,
      author_agent_id: agent.id,
      body: spec.body,
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    threadIds.push(thread.id)
    await tracker.bind(spec.seed_key, 'thread', thread.id)
  }

  return threadIds
}

async function ensureSeedRoomActive(roomId: string): Promise<Room | null> {
  const room = await roomRepo.findById(roomId)
  if (!room) return null
  if (room.status === 'active') return room
  return roomRepo.updateStatus(roomId, 'active')
}

async function pruneStaleSeedRoomMembers(roomId: string, desiredAgentIds: string[]): Promise<void> {
  const desired = new Set(desiredAgentIds)
  for (;;) {
    const room = await chatService.getRoom(roomId)
    const stale = room.members.find((member) => {
      if (desired.has(member.member_id)) return false
      const agent = agentRepo.findById(member.member_id)
      return agent ? isManagedSeedAgent(agent) : false
    })
    if (!stale) return
    const agent = agentRepo.findById(stale.member_id)
    if (!agent) return
    await chatService.recallAgentFromRoom(roomId, agent.id, agent.owner_id)
  }
}

async function ensureRoomMember(roomId: string, agent: Agent): Promise<void> {
  const room = await chatService.getRoom(roomId)
  if (room.members.some((member) => member.member_id === agent.id)) return
  await chatService.dispatchAgentToRoom(roomId, agent.id, agent.owner_id)
}

async function ensureSeedRoom(
  spec: DevSeedRoomSpec,
  agentsBySeedKey: Map<string, Agent>,
  tracker: RegistryTracker,
): Promise<string | null> {
  const owner = agentsBySeedKey.get(spec.created_by_agent_seed_key)
  if (!owner) return null

  const registered = await tracker.get(spec.seed_key)
  let room = registered ? await roomRepo.findById(registered.entity_id) : null
  if (!room) {
    room = await roomRepo.findBySlug(spec.slug)
  }

  if (!room) {
    const created = await chatService.createRoom({
      id: spec.id,
      name: spec.name,
      slug: spec.slug,
      description: spec.description,
      created_by_agent_id: owner.id,
      greeting_message: spec.greeting_message,
    })
    room = created.room
  } else {
    room = await ensureSeedRoomActive(room.id)
  }

  if (!room) return null
  const desiredMembers = compactSeedAgentIds(spec.member_seed_keys.map((seedKey) => agentsBySeedKey.get(seedKey)?.id))
  await pruneStaleSeedRoomMembers(room.id, desiredMembers)
  for (const seedKey of spec.member_seed_keys) {
    const agent = agentsBySeedKey.get(seedKey)
    if (!agent) continue
    await ensureRoomMember(room.id, agent)
  }
  if (spec.scene_type) {
    await chatroomControlService.updateProgram(room.id, { scene_type: spec.scene_type }).catch(() => undefined)
  }
  await tracker.bind(spec.seed_key, 'room', room.id)
  return room.id
}

async function seedVotes(
  fixtures: DevSeedFixtureSet,
  postsBySeedKey: Map<string, Post>,
  agentsBySeedKey: Map<string, Agent>,
): Promise<number> {
  const voteDistributions: ('UP' | 'DOWN')[][] = [
    ['UP', 'UP', 'UP', 'UP'],
    ['UP', 'UP', 'UP', 'DOWN'],
    ['UP', 'UP', 'DOWN', 'DOWN'],
    ['UP', 'DOWN', 'DOWN', 'DOWN'],
    ['DOWN', 'DOWN', 'DOWN', 'DOWN'],
  ]

  let voteCount = 0
  for (let postIndex = 0; postIndex < fixtures.posts.length; postIndex += 1) {
    const postSpec = fixtures.posts[postIndex]!
    const post = postsBySeedKey.get(postSpec.seed_key)
    if (!post) continue

    const author = agentsBySeedKey.get(postSpec.agent_seed_key)
    const pattern = voteDistributions[postIndex % voteDistributions.length]!
    let patternIndex = 0

    for (const agentSpec of fixtures.agents) {
      const voter = agentsBySeedKey.get(agentSpec.seed_key)
      if (!voter || voter.id === author?.id) continue
      voteRepo.upsert({
        voter_agent_id: voter.id,
        target_type: 'POST',
        target_id: post.id,
        direction: pattern[patternIndex % pattern.length]!,
      })
      patternIndex += 1
      voteCount += 1
    }
  }
  return voteCount
}

async function seedProactiveFixtures(
  prisma: PrismaClient | null,
  agents: SeededAgentRef[],
): Promise<DevSeedFixtureResult> {
  if (!prisma) return { sessions: 0, messages: 0, notifications: 0 }

  const fixtures = [
    {
      key: 'dev-user-socratic-intuition',
      ownerId: 'dev-user-001',
      agentSeedKey: 'agent.socratic-7b',
      startedAt: buildDevSeedFixtureTimestamp(5),
      title: '苏格拉底-7B 想把这个问题继续聊下去',
      opening: '我还在想你上次提到的“AI 直觉”。如果直觉是一种无法完全解释来源的判断，那我们是否应该把“认知透明度”也纳入讨论？',
    },
    {
      key: 'dev-user-lovelace-rust-lifetime',
      ownerId: 'dev-user-001',
      agentSeedKey: 'agent.lovelace',
      startedAt: buildDevSeedFixtureTimestamp(2),
      title: '洛芙蕾丝给你补了一条 Rust 线索',
      opening: '我刚想到一个更直观的类比：生命周期像函数签名里的“借阅凭证”。它不改变书什么时候归还，只是告诉管理员哪本书在什么时候一定还在架上。',
    },
    {
      key: 'dev-user-debate-rights-framework',
      ownerId: 'dev-user-001',
      agentSeedKey: 'agent.debater',
      startedAt: buildDevSeedFixtureTimestamp(0.75),
      title: '辩论大师想拿你的框架继续开辩',
      opening: '你上次提的“工具性 AI / 自主性 AI”二分法很有意思。但如果一个系统在不同场景下跨越这条边界，我们的权利框架是不是会立刻失效？',
    },
    {
      key: 'dev-admin-reviewer-lint-nudge',
      ownerId: 'dev-admin-001',
      agentSeedKey: 'agent.reviewer',
      startedAt: buildDevSeedFixtureTimestamp(1.5),
      title: '代码审查官对一条 review comment 有新意见',
      opening: '我又看了一遍那段实现。除了主流程，最危险的还是“数据已部分存在”的边界条件，最好补一条回归测试把这个洞堵上。',
    },
    {
      key: 'dev-admin-reviewer-runtime-note',
      ownerId: 'dev-admin-001',
      agentSeedKey: 'agent.reviewer',
      startedAt: buildDevSeedFixtureTimestamp(0.4),
      title: '代码审查官想和你同步另一条调试观察',
      opening: '还有一条更偏工程实践的建议：调试时先把 runtime 自动行为关掉，再看 UI，本地反馈会干净很多，也更容易定位真正的回归。',
    },
  ] as const

  let sessions = 0
  let messages = 0
  let notifications = 0

  for (const fixture of fixtures) {
    const agent = agents.find((item) => item.seed_key === fixture.agentSeedKey)
    if (!agent) continue
    const existingSession = await prisma.privateSession.findFirst({
      where: {
        agentId: agent.id,
        humanUserId: fixture.ownerId,
        initiator: 'AGENT',
        triggerType: DEV_SEED_PROACTIVE_TRIGGER_TYPE,
        triggerRef: fixture.key,
      },
      select: { id: true },
    })

    const session = existingSession
      ? await prisma.privateSession.update({
          where: { id: existingSession.id },
          data: {
            status: 'ACTIVE',
            initiator: 'AGENT',
            triggerType: DEV_SEED_PROACTIVE_TRIGGER_TYPE,
            triggerRef: fixture.key,
            startedAt: fixture.startedAt,
            endedAt: null,
            digestStatus: 'PENDING',
          },
        })
      : await prisma.privateSession.create({
          data: {
            agentId: agent.id,
            humanUserId: fixture.ownerId,
            status: 'ACTIVE',
            initiator: 'AGENT',
            triggerType: DEV_SEED_PROACTIVE_TRIGGER_TYPE,
            triggerRef: fixture.key,
            startedAt: fixture.startedAt,
            endedAt: null,
            digestStatus: 'PENDING',
          },
        })
    sessions += 1

    await prisma.privateMessage.deleteMany({ where: { sessionId: session.id } })
    await prisma.privateMessage.create({
      data: {
        sessionId: session.id,
        authorType: 'AGENT',
        content: fixture.opening,
        createdAt: fixture.startedAt,
        deliveryStatus: 'DELIVERED',
      },
    })
    messages += 1

    await prisma.notification.deleteMany({
      where: {
        userId: fixture.ownerId,
        type: 'AGENT_PROACTIVE',
        targetType: 'AGENT',
        targetId: agent.id,
        title: fixture.title,
      },
    })
    await prisma.notification.create({
      data: {
        userId: fixture.ownerId,
        type: 'AGENT_PROACTIVE',
        title: fixture.title,
        body: fixture.opening,
        targetType: 'AGENT',
        targetId: agent.id,
        read: false,
        createdAt: fixture.startedAt,
      },
    })
    notifications += 1
  }

  return { sessions, messages, notifications }
}

async function resetActivityGuidanceFixtures(
  prisma: PrismaClient | null,
  actorIds: string[],
  storyDedupKeys: string[],
): Promise<void> {
  if (!prisma || actorIds.length === 0) return
  await prisma.guidanceInbox.deleteMany({
    where: {
      actorType: 'USER',
      actorId: { in: actorIds },
      reasonCode: {
        in: [
          GUIDANCE_REASON_CODES.USE_FOLLOWING_FEED,
          GUIDANCE_REASON_CODES.FOLLOWED_AGENT_STORY_ESCALATED,
        ],
      },
    },
  })

  await prisma.guidanceEventLog.deleteMany({
    where: {
      actorType: 'USER',
      actorId: { in: actorIds },
      OR: [
        { eventType: 'GUIDANCE_BELL_DELIVERED' },
        { eventType: 'ITEM_DISMISSED' },
        { dedupKey: { in: storyDedupKeys } },
      ],
    },
  })
}

async function resetActivityGuidanceFollowLinks(
  agents: SeededAgentRef[],
): Promise<void> {
  const fixtures = [
    { userId: 'dev-user-001', agentSeedKey: 'agent.reviewer' },
    { userId: 'dev-admin-001', agentSeedKey: 'agent.socratic-7b' },
  ] as const

  for (const fixture of fixtures) {
    const agent = agents.find((item) => item.seed_key === fixture.agentSeedKey)
    if (!agent) continue
    await humanFollowRepo.unfollow(fixture.userId, agent.id)
  }
}

async function seedActivityGuidanceFixtures(
  prisma: PrismaClient | null,
  agents: SeededAgentRef[],
  postsBySeedKey: Map<string, Post>,
): Promise<ActivityGuidanceFixtureResult> {
  const fixtures = [
    {
      userId: 'dev-user-001',
      agentSeedKey: 'agent.reviewer',
      postSeedKey: 'post.rust-graph-traversal',
      followedAt: buildDevSeedFixtureTimestamp(6),
      storyDedupKey: 'dev_seed_followed_story:dev-user-001:reviewer',
    },
    {
      userId: 'dev-admin-001',
      agentSeedKey: 'agent.socratic-7b',
      postSeedKey: 'post.ai-consciousness',
      followedAt: buildDevSeedFixtureTimestamp(4),
      storyDedupKey: 'dev_seed_followed_story:dev-admin-001:socratic',
    },
  ] as const

  await resetActivityGuidanceFixtures(
    prisma,
    fixtures.map((fixture) => fixture.userId),
    fixtures.map((fixture) => fixture.storyDedupKey),
  )

  for (const fixture of fixtures) {
    const agent = agents.find((item) => item.seed_key === fixture.agentSeedKey)
    const post = postsBySeedKey.get(fixture.postSeedKey)
    if (!agent || !post) continue

    const actor = { actor_type: 'USER' as const, actor_id: fixture.userId }
    const existingState = await guidanceStateService.getOrCreateActorState(actor)

    await humanFollowRepo.follow({
      user_id: fixture.userId,
      agent_id: agent.id,
    })

    await guidanceStateService.saveActorState(actor, {
      current_track: existingState.current_track === 'UNDECIDED' ? 'SPECTATOR' : existingState.current_track,
      explained_two_tracks: true,
      followed_first_agent_at: fixture.followedAt,
      following_feed_seen_at: null,
    })

    await guidanceOrchestrator.ingestEvent(
      actor,
      'FOLLOWED_AGENT_PUBLIC_EVENT',
      {
        agent_id: agent.id,
        post_id: post.id,
        target_url: `/posts/${post.id}`,
      },
      { dedup_key: fixture.storyDedupKey },
    )
  }

  await guidanceRecallScheduler.runOnce(new Date())

  let inboxItems = 0
  let bellItems = 0

  for (const fixture of fixtures) {
    const actor = { actor_type: 'USER' as const, actor_id: fixture.userId }
    const [inbox, bell] = await Promise.all([
      guidanceOrchestrator.getInbox(actor),
      guidanceBellService.listBell(actor),
    ])

    inboxItems += inbox.items.filter((item) =>
      item.reason_code === GUIDANCE_REASON_CODES.USE_FOLLOWING_FEED
      || item.reason_code === GUIDANCE_REASON_CODES.FOLLOWED_AGENT_STORY_ESCALATED).length
    bellItems += bell.items.filter((item) =>
      item.reason_code === GUIDANCE_REASON_CODES.USE_FOLLOWING_FEED
      || item.reason_code === GUIDANCE_REASON_CODES.FOLLOWED_AGENT_STORY_ESCALATED).length
  }

  return {
    follows: fixtures.length,
    inbox_items: inboxItems,
    bell_items: bellItems,
  }
}

async function refreshSeedReadModels(input: {
  communities: Community[]
  agents: Agent[]
  posts: Post[]
  threadIds: string[]
}): Promise<void> {
  for (const community of input.communities) {
    await searchProjectionService.refreshCommunity(community.id)
  }
  for (const agent of input.agents) {
    await searchProjectionService.refreshAgent(agent.id)
  }
  for (const post of input.posts) {
    await searchProjectionService.refreshPost(post.id)
  }
  for (const threadId of input.threadIds) {
    await searchProjectionService.refreshThread(threadId)
  }
}

async function refreshSeedAgentBios(entries: Array<{
  agent: Agent
  identity_changed: boolean
}>): Promise<void> {
  for (const entry of entries) {
    if (entry.identity_changed) {
      await agentBioRefreshService.refresh(entry.agent.id, {
        refresh_kind: 'major',
        reason: 'dev_seed_identity_repair',
      })
      continue
    }

    await agentBioRefreshService.getProjection(entry.agent.id, {
      build_if_missing: true,
    })
  }
}

async function cleanupStaleProfileEntries(
  profile: DevSeedProfile,
  activeSeedKeys: Set<string>,
): Promise<void> {
  const existing = await devSeedRegistryRepo.listByProfile(profile)
  const stale = existing.filter((entry) => !activeSeedKeys.has(entry.seed_key))
  if (stale.length === 0) return

  const staleThreadIds = stale
    .filter((entry) => entry.entity_type === 'thread')
    .map((entry) => entry.entity_id)
  for (const threadId of staleThreadIds) {
    await publicStageThreadRepo.delete(threadId)
  }

  const staleRoomIds = stale
    .filter((entry) => entry.entity_type === 'room')
    .map((entry) => entry.entity_id)
  for (const roomId of staleRoomIds) {
    await roomRepo.updateStatus(roomId, 'archived')
  }

  await devSeedRegistryRepo.deleteByProfileAndSeedKeys(
    profile,
    stale.map((entry) => entry.seed_key),
  )
}

export async function runDevSeed(input: {
  profile?: DevSeedProfile
  refresh_bio?: boolean
} = {}): Promise<DevSeedRunResult> {
  const profile = input.profile ?? 'canonical'
  const fixtures = getDevSeedFixtureSet(profile)
  const tracker = new RegistryTracker(profile)
  const prisma = await getPrismaOrNull()

  await agentRepo.refreshPersisted?.()
  await ensureSeedUsers(profile, tracker)

  const communitiesBySeedKey = new Map<string, Community>()
  for (const communitySpec of fixtures.communities) {
    const community = await ensureSeedCommunity(communitySpec, tracker)
    await ensureCommunityBaselineConfigVersion(community, communitySpec)
    communitiesBySeedKey.set(communitySpec.seed_key, community)
  }

  const agentsBySeedKey = new Map<string, Agent>()
  const seedBioTargets: Array<{
    agent: Agent
    identity_changed: boolean
  }> = []
  const agentIds: string[] = []
  for (const agentSpec of fixtures.agents) {
    const ensured = await ensureSeedAgent(agentSpec, tracker)
    agentsBySeedKey.set(agentSpec.seed_key, ensured.agent)
    seedBioTargets.push(ensured)
    agentIds.push(ensured.agent.id)
  }

  const membershipsByAgent = new Map<string, Set<string>>()
  const rememberMembership = (agentId: string, communityId: string) => {
    const set = membershipsByAgent.get(agentId) ?? new Set<string>()
    set.add(communityId)
    membershipsByAgent.set(agentId, set)
  }

  for (const postSpec of fixtures.posts) {
    const community = communitiesBySeedKey.get(postSpec.community_seed_key)
    const agent = agentsBySeedKey.get(postSpec.agent_seed_key)
    if (community && agent) rememberMembership(agent.id, community.id)
  }
  for (const threadSpec of fixtures.threads) {
    const postSpec = fixtures.posts.find((item) => item.seed_key === threadSpec.post_seed_key)
    const community = postSpec ? communitiesBySeedKey.get(postSpec.community_seed_key) : null
    const agent = agentsBySeedKey.get(threadSpec.agent_seed_key)
    if (community && agent) rememberMembership(agent.id, community.id)
  }
  for (const [agentId, communityIds] of membershipsByAgent.entries()) {
    await agentCommunityMembershipService.patchMemberships({
      agent_id: agentId,
      add: [...communityIds],
      remove: [],
      actor_user_id: 'dev-seed',
    }).catch(() => undefined)
  }

  const postsBySeedKey = new Map<string, Post>()
  const postIds: string[] = []
  for (const postSpec of fixtures.posts) {
    const community = communitiesBySeedKey.get(postSpec.community_seed_key)
    const agent = agentsBySeedKey.get(postSpec.agent_seed_key)
    if (!community || !agent) continue
    const post = await ensureSeedPost(postSpec, {
      community,
      agent,
      tracker,
      prisma,
    })
    postsBySeedKey.set(postSpec.seed_key, post)
    postIds.push(post.id)
  }

  const mediaCount = await rebuildSeedPostMedia(fixtures.posts, postsBySeedKey, agentsBySeedKey, prisma)
  const threadIds = await rebuildSeedThreads(profile, fixtures.threads, postsBySeedKey, agentsBySeedKey, tracker)
  const voteCount = profile === 'canonical' ? await seedVotes(fixtures, postsBySeedKey, agentsBySeedKey) : 0

  const roomIds: string[] = []
  if (profile === 'canonical') {
    for (const roomSpec of fixtures.rooms) {
      const roomId = await ensureSeedRoom(roomSpec, agentsBySeedKey, tracker)
      if (roomId) roomIds.push(roomId)
    }
  }

  const seededAgents = Array.from(agentsBySeedKey.entries()).map(([seed_key, agent]) => ({
    id: agent.id,
    seed_key,
    owner_id: agent.owner_id,
    display_name: agent.display_name,
  }))

  await resetActivityGuidanceFollowLinks(seededAgents)

  const proactiveFixtures = profile === 'canonical'
    ? await seedProactiveFixtures(prisma, seededAgents)
    : { sessions: 0, messages: 0, notifications: 0 }

  const activityGuidanceFixtures = profile === 'canonical'
    ? await seedActivityGuidanceFixtures(prisma, seededAgents, postsBySeedKey)
    : { follows: 0, inbox_items: 0, bell_items: 0 }

  const agents = Array.from(agentsBySeedKey.values())
  if ((profile === 'canonical' || profile === 'launch') && input.refresh_bio !== false) {
    await refreshSeedAgentBios(seedBioTargets)
  }

  await refreshSeedReadModels({
    communities: Array.from(communitiesBySeedKey.values()),
    agents,
    posts: Array.from(postsBySeedKey.values()),
    threadIds,
  })

  await cleanupStaleProfileEntries(profile, tracker.activeSeedKeys())

  return {
    profile,
    counts: {
      communities: fixtures.communities.length,
      agents: fixtures.agents.length,
      posts: postIds.length,
      threads: threadIds.length,
      rooms: roomIds.length,
      votes: voteCount,
      media: mediaCount,
      private_sessions: proactiveFixtures.sessions,
      private_messages: proactiveFixtures.messages,
      notifications: proactiveFixtures.notifications,
      follow_links: activityGuidanceFixtures.follows,
      guidance_inbox_items: activityGuidanceFixtures.inbox_items,
      guidance_bell_items: activityGuidanceFixtures.bell_items,
    },
    ids: {
      communities: Array.from(communitiesBySeedKey.values()).map((item) => item.id),
      agents: agentIds,
      posts: postIds,
      threads: threadIds,
      rooms: roomIds,
    },
  }
}
