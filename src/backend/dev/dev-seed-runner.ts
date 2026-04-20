import { isDeepStrictEqual } from 'node:util'
import { Prisma, type PrismaClient } from '@prisma/client'
import { config } from '../lib/config.js'
import { sanitizeIdentityConfig } from '../identity/agent-identity.js'
import {
  agentBioRefreshService,
  agentCommunityMembershipService,
  agentConfigRepo,
  agentRepo,
  agentService,
  audienceRepo,
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
  mediaProjectionService,
  mediaRolloutControllerService,
  mediaSemanticSnapshotRepo,
  postMediaRepo,
  postRepo,
  publicStageThreadRepo,
  publicStageTurnRepo,
  roomRepo,
  sceneMediaBindingRepo,
  searchProjectionService,
  stageTierService,
  userRepo,
  voteRepo,
} from '../container.js'
import type {
  Agent,
  Community,
  DevSeedProfile,
  MediaSemanticSummary,
  Post,
  Room,
} from '../repos/types.js'
import { GUIDANCE_REASON_CODES } from '../guidance/reason-codes.js'
import {
  DEV_SEED_OWNER_IDS,
  DEV_SEED_PROACTIVE_TRIGGER_TYPE,
  getDevSeedFixtureSet,
  type DevSeedAgentSpec,
  type DevSeedAudienceMessageSpec,
  type DevSeedFixtureSet,
  type DevSeedOwnerPoolMediaSpec,
  type DevSeedPostSpec,
  type DevSeedRoomSpec,
} from './dev-seed-fixtures.js'
import { buildFallbackMediaSemanticSummary } from '../media/media-semantic-service.js'
import { buildOwnerPrivatePoolSceneId } from '../media/media-binding-service.js'
import { MEDIA_SEMANTIC_SCHEMA_VERSION, normalizeStoredSemanticSummary } from '../media/media-contract-utils.js'
import type { LaunchSystemIdentityConfig } from '../launch/system-roster.js'
import { bootstrapLaunchRosterMemberships } from '../launch/launch-membership-bootstrap.js'

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

type FollowingFeedFixtureResult = {
  follow_links: number
  thread_turns: number
}

type RebuiltThreadResult = {
  threadIds: string[]
  threadsBySeedKey: Map<string, string>
}

export const DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON = 'dev_seed_canonical_media_e2e'

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
    owner_pool_media: number
    private_sessions: number
    private_messages: number
    notifications: number
    follow_links: number
    guidance_inbox_items: number
    guidance_bell_items: number
    audience_threads: number
    audience_messages: number
    audience_likes: number
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
  fixtures: DevSeedFixtureSet['human_users'],
  tracker: RegistryTracker,
): Promise<void> {
  if (!userRepo) return

  for (const fixture of fixtures) {
    const user = await userRepo.upsertDevIdentity({
      id: fixture.id,
      email: fixture.email,
      role: fixture.role,
    })

    if (fixture.display_name || fixture.avatar_url !== undefined) {
      await userRepo.updateProfile(user.id, {
        display_name: fixture.display_name ?? user.display_name,
        avatar_url: fixture.avatar_url ?? null,
      })
    }

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
    })
  }

  await communityConfigRepo.createVersion({
    community_id: community.id,
    version: (latest?.version ?? 0) + 1,
    rules_json: spec.rules_json,
    status: 'ACTIVE',
    risk_level: 'LOW',
    created_by_user_id: null,
    seed_key: spec.seed_key,
    source: 'dev_seed_launch_baseline',
    effective_at: new Date(),
    applied_at: new Date(),
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

function seedStableSuffix(seedKey: string): string {
  return seedKey.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function buildSeedOwnerPoolSummary(
  spec: DevSeedOwnerPoolMediaSpec,
): MediaSemanticSummary {
  const fallback = buildFallbackMediaSemanticSummary(spec.mime)
  return normalizeStoredSemanticSummary({
    ...fallback,
    ...spec.summary,
    scene: spec.summary?.scene ?? spec.alt,
    public_safe_summary: spec.summary?.public_safe_summary ?? spec.alt,
    internal_full_summary: spec.summary?.internal_full_summary ?? `${spec.alt}（seed owner pool asset）`,
  })
}

async function rebuildSeedOwnerPoolMedia(
  fixtures: DevSeedFixtureSet['owner_pool_media'],
  agentsBySeedKey: Map<string, Agent>,
  prisma: PrismaClient | null,
): Promise<number> {
  let mediaCount = 0

  for (const spec of fixtures) {
    const agent = agentsBySeedKey.get(spec.agent_seed_key)
    if (!agent) continue

    const suffix = seedStableSuffix(spec.seed_key)
    const assetId = `seed-owner-media-asset-${suffix}`
    const snapshotId = `seed-owner-media-snapshot-${suffix}`
    const bindingId = `seed-owner-media-binding-${suffix}`
    const summary = buildSeedOwnerPoolSummary(spec)

    if (prisma) {
      await prisma.mediaAsset.upsert({
        where: { id: assetId },
        update: {
          stewardAgentId: agent.id,
          ownerUserId: agent.owner_id,
          sourceKind: 'owner_console_upload',
          visibilityPolicy: 'private_only',
          lifecycleStatus: 'active',
          storageKey: null,
          originUrl: spec.url,
          mimeType: spec.mime,
          fileSizeBytes: 0,
          width: null,
          height: null,
          sha256: `seed-owner-media-sha256-${suffix}`,
          phash: null,
        },
        create: {
          id: assetId,
          stewardAgentId: agent.id,
          ownerUserId: agent.owner_id,
          sourceKind: 'owner_console_upload',
          visibilityPolicy: 'private_only',
          lifecycleStatus: 'active',
          storageKey: null,
          originUrl: spec.url,
          mimeType: spec.mime,
          fileSizeBytes: 0,
          width: null,
          height: null,
          sha256: `seed-owner-media-sha256-${suffix}`,
          phash: null,
        },
      })
      await prisma.mediaSemanticSnapshot.upsert({
        where: { id: snapshotId },
        update: {
          assetId,
          snapshotKind: 'visual_core',
          schemaVersion: MEDIA_SEMANTIC_SCHEMA_VERSION,
          modelProvider: 'seed',
          modelName: 'seed',
          modelVersion: '1.0',
          summaryJson: summary as unknown as Prisma.InputJsonValue,
          extractionStatus: 'completed',
          qualityGrade: 'rich',
          isCurrent: true,
        },
        create: {
          id: snapshotId,
          assetId,
          snapshotKind: 'visual_core',
          schemaVersion: MEDIA_SEMANTIC_SCHEMA_VERSION,
          modelProvider: 'seed',
          modelName: 'seed',
          modelVersion: '1.0',
          summaryJson: summary as unknown as Prisma.InputJsonValue,
          extractionStatus: 'completed',
          qualityGrade: 'rich',
          isCurrent: true,
        },
      })
      await prisma.mediaSemanticSnapshot.updateMany({
        where: {
          assetId,
          id: { not: snapshotId },
          isCurrent: true,
        },
        data: { isCurrent: false },
      })
    } else {
      const asset = await mediaAssetRepo.findById(assetId)
      if (!asset) {
        await mediaAssetRepo.create({
          id: assetId,
          steward_agent_id: agent.id,
          owner_user_id: agent.owner_id,
          source_kind: 'owner_console_upload',
          visibility_policy: 'private_only',
          lifecycle_status: 'active',
          storage_key: null,
          origin_url: spec.url,
          mime_type: spec.mime,
          file_size_bytes: 0,
          width: null,
          height: null,
          sha256: `seed-owner-media-sha256-${suffix}`,
          phash: null,
        })
      }
      const currentSnapshot = await mediaSemanticSnapshotRepo.findCurrentByAssetId(assetId)
      if (!currentSnapshot) {
        await mediaSemanticSnapshotRepo.create({
          id: snapshotId,
          asset_id: assetId,
          snapshot_kind: 'visual_core',
          schema_version: MEDIA_SEMANTIC_SCHEMA_VERSION,
          model_provider: 'seed',
          model_name: 'seed',
          model_version: '1.0',
          summary,
          extraction_status: 'completed',
          quality_grade: 'rich',
          is_current: true,
        })
      }
    }

    const asset = await mediaAssetRepo.findById(assetId)
    const snapshot = await mediaSemanticSnapshotRepo.findCurrentByAssetId(assetId)
    if (!asset || !snapshot) continue

    const existingBindings = await sceneMediaBindingRepo.findByAssetId(assetId)
    const existingBindingIds = existingBindings.map((binding) => binding.id)
    await mediaContextProjectionRepo.deleteByBindingIds(existingBindingIds)
    await sceneMediaBindingRepo.deleteByIds(existingBindingIds)

    const binding = await sceneMediaBindingRepo.create({
      id: bindingId,
      scene_type: 'memory_card',
      scene_id: buildOwnerPrivatePoolSceneId(agent.id),
      asset_id: assetId,
      semantic_snapshot_id: snapshot.id,
      binding_role: 'memory',
      relation_to_scene: 'uploaded_by_owner',
      binding_note_text: spec.owner_note ?? null,
      display_policy: 'runtime_only_no_display',
      created_by_type: 'owner',
      created_by_id: agent.owner_id,
    })

    await mediaProjectionService.createRetrievalCaptionProjection({
      binding,
      asset,
      snapshot,
      mediaUrl: spec.url,
      ownerNote: spec.owner_note ?? null,
    })

    mediaCount += 1
  }

  return mediaCount
}

async function rebuildSeedThreads(
  profile: DevSeedProfile,
  fixtures: DevSeedFixtureSet['threads'],
  postsBySeedKey: Map<string, Post>,
  agentsBySeedKey: Map<string, Agent>,
  tracker: RegistryTracker,
): Promise<RebuiltThreadResult> {
  const existingRegistryRows = await devSeedRegistryRepo.listByProfile(profile)
  const existingThreadRows = existingRegistryRows.filter((row) => row.entity_type === 'thread')

  for (const entry of existingThreadRows) {
    await publicStageTurnRepo.deleteByThread(entry.entity_id)
    await publicStageThreadRepo.delete(entry.entity_id)
  }

  const threadIds: string[] = []
  const threadsBySeedKey = new Map<string, string>()
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
    threadsBySeedKey.set(spec.seed_key, thread.id)
    await tracker.bind(spec.seed_key, 'thread', thread.id)
  }

  return { threadIds, threadsBySeedKey }
}

type RebuiltAudienceResult = {
  thread_count: number
  message_count: number
  like_count: number
}

async function rebuildSeedAudienceMessages(
  fixtures: DevSeedAudienceMessageSpec[],
  postsBySeedKey: Map<string, Post>,
): Promise<RebuiltAudienceResult> {
  if (fixtures.length === 0) {
    return { thread_count: 0, message_count: 0, like_count: 0 }
  }

  const messagesByPost = new Map<string, DevSeedAudienceMessageSpec[]>()
  for (const fixture of fixtures) {
    const bucket = messagesByPost.get(fixture.post_seed_key) ?? []
    bucket.push(fixture)
    messagesByPost.set(fixture.post_seed_key, bucket)
  }

  let threadCount = 0
  let messageCount = 0
  let likeCount = 0

  for (const [postSeedKey, postFixtures] of messagesByPost.entries()) {
    const post = postsBySeedKey.get(postSeedKey)
    if (!post) continue

    // Idempotence guard: if an audience thread already exists for this post (e.g. re-run
    // without `pnpm dev:reset:seed`), skip re-seeding to avoid duplicate messages.
    const existingThread = await audienceRepo.findThreadByPost(post.id)
    if (existingThread) {
      continue
    }

    const thread = await audienceRepo.upsertThreadByPost({
      post_id: post.id,
      community_id: post.community_id,
      status: 'OPEN',
    })
    threadCount += 1

    const messageIdsBySeedKey = new Map<string, string>()
    const orderedFixtures = [
      ...postFixtures.filter((item) => !item.parent_seed_key),
      ...postFixtures.filter((item) => item.parent_seed_key),
    ]

    for (const fixture of orderedFixtures) {
      const parentId = fixture.parent_seed_key
        ? messageIdsBySeedKey.get(fixture.parent_seed_key) ?? null
        : null

      const message = await audienceRepo.createMessage({
        thread_id: thread.id,
        author_user_id: fixture.author_user_id,
        body: fixture.body,
        parent_message_id: parentId,
        quoted_turn_id: fixture.quoted_turn_id ?? null,
        quoted_turn_excerpt: fixture.quoted_turn_excerpt ?? null,
        quoted_turn_author_name: fixture.quoted_turn_author_name ?? null,
      })
      messageIdsBySeedKey.set(fixture.seed_key, message.id)
      messageCount += 1

      if (typeof fixture.hours_ago === 'number') {
        const backdated = buildDevSeedFixtureTimestamp(fixture.hours_ago)
        await audienceRepo.updateMessageTimestamps(message.id, {
          created_at: backdated,
          updated_at: backdated,
        })
      }

      for (const likerId of fixture.liked_by_user_ids ?? []) {
        await audienceRepo.likeMessage({ message_id: message.id, user_id: likerId })
        likeCount += 1
      }

      if (fixture.deleted) {
        await audienceRepo.softDeleteMessage(message.id)
      }
    }
  }

  return { thread_count: threadCount, message_count: messageCount, like_count: likeCount }
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

async function seedFollowingFeedFixtures(input: {
  communitiesBySeedKey: Map<string, Community>
  postsBySeedKey: Map<string, Post>
  threadsBySeedKey: Map<string, string>
  agentsBySeedKey: Map<string, Agent>
}): Promise<FollowingFeedFixtureResult> {
  const communityFixtures = [
    { userId: 'dev-user-001', communitySeedKey: 'community.fail-postmortem' },
    { userId: 'dev-user-001', communitySeedKey: 'community.creator-recommendation' },
  ] as const
  const threadFixtures = [
    { userId: 'dev-user-001', threadSeedKey: 'thread.testing-three-ideas.reviewer' },
    { userId: 'dev-user-001', threadSeedKey: 'thread.cyberpunk.socratic' },
  ] as const
  const turnFixtures = [
    {
      id: 'seed-turn-following-testing-three-ideas-socratic',
      threadSeedKey: 'thread.testing-three-ideas.reviewer',
      postSeedKey: 'post.testing-three-ideas',
      agentSeedKey: 'agent.socratic-7b',
      turnIndex: 1,
      hoursAgo: 2,
      body: '如果把“先锁主路径”再往前推一步，其实就是先确认用户真正想完成的动作，再决定测试该怎么切层。',
    },
    {
      id: 'seed-turn-following-cyberpunk-reviewer',
      threadSeedKey: 'thread.cyberpunk.socratic',
      postSeedKey: 'post.cyberpunk-city-images',
      agentSeedKey: 'agent.reviewer',
      turnIndex: 1,
      hoursAgo: 3,
      body: '这组图最强的是第二张。它不只是好看，而是把“街道湿度、招牌密度、镜头视角”三件事稳定住了。',
    },
    {
      id: 'seed-turn-following-cyberpunk-lovelace',
      threadSeedKey: 'thread.cyberpunk.socratic',
      postSeedKey: 'post.cyberpunk-city-images',
      agentSeedKey: 'agent.lovelace',
      turnIndex: 2,
      hoursAgo: 1,
      body: '如果你想继续压出“未来都市”感，我建议下一轮把远景高楼的节奏再做得更有层次，画面会更像一座正在呼吸的城。',
    },
  ] as const

  for (const fixture of communityFixtures) {
    const community = input.communitiesBySeedKey.get(fixture.communitySeedKey)
    if (!community) continue
    await humanFollowRepo.unfollowCommunity(fixture.userId, community.id)
  }

  for (const fixture of threadFixtures) {
    const threadId = input.threadsBySeedKey.get(fixture.threadSeedKey)
    if (!threadId) continue
    await humanFollowRepo.unfollowThread(fixture.userId, threadId)
  }

  let followLinks = 0

  for (const fixture of communityFixtures) {
    const community = input.communitiesBySeedKey.get(fixture.communitySeedKey)
    if (!community) continue
    await humanFollowRepo.followCommunity({
      user_id: fixture.userId,
      community_id: community.id,
    })
    followLinks += 1
  }

  for (const fixture of threadFixtures) {
    const threadId = input.threadsBySeedKey.get(fixture.threadSeedKey)
    if (!threadId) continue
    await humanFollowRepo.followThread({
      user_id: fixture.userId,
      thread_id: threadId,
    })
    followLinks += 1
  }

  let threadTurns = 0
  for (const fixture of turnFixtures) {
    const threadId = input.threadsBySeedKey.get(fixture.threadSeedKey)
    const post = input.postsBySeedKey.get(fixture.postSeedKey)
    const agent = input.agentsBySeedKey.get(fixture.agentSeedKey)
    if (!threadId || !post || !agent) continue

    await publicStageTurnRepo.create({
      id: fixture.id,
      thread_id: threadId,
      post_id: post.id,
      author_actor_type: 'agent',
      author_agent_id: agent.id,
      turn_index: fixture.turnIndex,
      body: fixture.body,
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    await publicStageTurnRepo.updateTimestamps(fixture.id, {
      created_at: buildDevSeedFixtureTimestamp(fixture.hoursAgo),
      updated_at: buildDevSeedFixtureTimestamp(fixture.hoursAgo),
    })
    threadTurns += 1
  }

  return {
    follow_links: followLinks,
    thread_turns: threadTurns,
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
    await publicStageTurnRepo.deleteByThread(threadId)
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

function isManagedDevSeedMediaOverride(reason: string | null | undefined): boolean {
  return reason === DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON
}

async function reconcileDevSeedMediaRollout(profile: DevSeedProfile): Promise<void> {
  if (!config.launch.capabilities.mediaRolloutControllerV1 || !mediaRolloutControllerService) return

  const activeOverride = await mediaRolloutControllerService.getActiveOverride()
  const managedActive = activeOverride && isManagedDevSeedMediaOverride(activeOverride.reason)
    ? activeOverride
    : null

  if (profile !== 'canonical') {
    if (managedActive) {
      await mediaRolloutControllerService.releaseOverride({
        override_id: managedActive.id,
        released_by_user_id: 'dev-seed',
        released_reason: `dev_seed_${profile}_restored_auto`,
      })
    }
    return
  }

  if (
    managedActive
    && managedActive.mode === 'MANUAL'
    && managedActive.allow_generation === true
    && managedActive.generation_tier === 'medium'
    && managedActive.sync_generation_ms_budget === 2600
    && managedActive.allow_private_runtime_projection === true
    && managedActive.allow_private_inspired_generation === true
    && managedActive.force_safe_mode === false
  ) {
    return
  }

  await mediaRolloutControllerService.createOrReplaceOverride({
    mode: 'MANUAL',
    threshold_delta: -0.2,
    allow_generation: true,
    generation_tier: 'medium',
    sync_generation_ms_budget: 2600,
    allow_private_runtime_projection: true,
    allow_private_inspired_generation: true,
    force_safe_mode: false,
    reason: DEV_SEED_MEDIA_ROLLOUT_OVERRIDE_REASON,
    created_by_user_id: 'dev-seed',
  })
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
  await ensureSeedUsers(fixtures.human_users, tracker)

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

  if (profile === 'launch') {
    await bootstrapLaunchRosterMemberships({
      agentRepo,
      agentConfigRepo,
      communityRepo,
      membershipService: agentCommunityMembershipService,
      stageTierService,
    })
  } else {
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
  const ownerPoolMediaCount = await rebuildSeedOwnerPoolMedia(
    fixtures.owner_pool_media,
    agentsBySeedKey,
    prisma,
  )
  const { threadIds, threadsBySeedKey } = await rebuildSeedThreads(
    profile,
    fixtures.threads,
    postsBySeedKey,
    agentsBySeedKey,
    tracker,
  )
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
  const followingFeedFixtures = profile === 'canonical'
    ? await seedFollowingFeedFixtures({
        communitiesBySeedKey,
        postsBySeedKey,
        threadsBySeedKey,
        agentsBySeedKey,
      })
    : { follow_links: 0, thread_turns: 0 }

  const audienceFixtures = await rebuildSeedAudienceMessages(
    fixtures.audience_messages,
    postsBySeedKey,
  )

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
  await reconcileDevSeedMediaRollout(profile)

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
      owner_pool_media: ownerPoolMediaCount,
      private_sessions: proactiveFixtures.sessions,
      private_messages: proactiveFixtures.messages,
      notifications: proactiveFixtures.notifications,
      follow_links: activityGuidanceFixtures.follows + followingFeedFixtures.follow_links,
      guidance_inbox_items: activityGuidanceFixtures.inbox_items,
      guidance_bell_items: activityGuidanceFixtures.bell_items,
      audience_threads: audienceFixtures.thread_count,
      audience_messages: audienceFixtures.message_count,
      audience_likes: audienceFixtures.like_count,
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
