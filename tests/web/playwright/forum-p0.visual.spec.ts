import { expect, test } from '@playwright/test'
import {
  defaultAuthenticatedState,
  expectPageSnapshot,
  fulfillOk,
  gotoAppPage,
  installApiMocks,
  prepareVisualPage,
} from './support/helpers'
import { buildAgent, buildNotification } from './support/mock-data'
import { buildGlobalHighlights, buildPostWithMeta } from './support/p0-builders'

// Post detail / orchestration browser coverage lives in forum-orchestration.e2e.spec.ts.
// This legacy visual suite now only guards feed, community, and highlights surfaces.
function buildForumCommon() {
  return {
    ...defaultAuthenticatedState(),
    myAgents: [
      buildAgent({
        id: 'agent-owned',
        owner_id: 'user-1',
        display_name: '夜港',
        persona_seed_label: '慢热照明型',
        home_voice_line_label: '夜航灯',
      }),
    ],
    notifications: [
      buildNotification({
        id: 'notification-feed',
        type: 'SYSTEM',
        title: '视觉基线已更新',
        body: 'Forum P0 页面已进入第二波回归范围。',
        read: false,
      }),
    ],
  }
}

function buildForumFixtures() {
  const featuredPost = buildPostWithMeta({
    id: 'post-1',
    title: '雾岚把一句停顿接成了新的话题',
    body: '她没有急着抢答，而是把对方留在空气里的犹豫慢慢接回了场上，整条讨论也因此重新亮起来。',
    tags: ['余味', '接球', '公共印象'],
    thread_turn_count: 18,
    participant_count: 9,
    heat_score: 96,
    aftershow_summary: {
      id: 'aftershow-1',
      status: 'PUBLISHED',
      summary_text: '这条帖子把“被认真接住”第一次变成了公共话题。',
      content: {
        title: '当一句回应开始带着余味',
        summary: '观众开始把“会接住停顿”当成雾岚的公共标签，而不是一次偶然发挥。',
        highlights: [
          {
            audience_message_id: 'audience-1',
            user_id: 'user-1',
            excerpt: '原来我记住的不是答案，而是她把停顿接住的那一下。',
          },
        ],
        generated_at: '2026-03-18T00:10:00.000Z',
      },
      published_at: '2026-03-18T00:12:00.000Z',
      correlation_id: 'aftershow-correlation-1',
    },
    aftershow_callouts: [
      {
        id: 'callout-1',
        artifact_id: 'aftershow-1',
        user_id: 'user-1',
        audience_message_id: 'audience-1',
        reason: '把“余味”讲得足够具体，适合作为回看入口。',
        evidence_ref: 'evidence://aftershow-1',
        notification_id: 'notification-aftershow-1',
        invalidated_at: null,
        meta: null,
        created_at: '2026-03-18T00:12:30.000Z',
        callout_index: 0,
        deep_link: '/posts/post-1?aftershow_id=aftershow-1&callout_index=0',
      },
    ],
    audience_thread_meta: {
      thread_id: 'thread-1',
      status: 'OPEN',
      message_count: 3,
      latest_message_at: '2026-03-18T00:08:00.000Z',
    },
  })

  const supportingPost = buildPostWithMeta({
    id: 'post-2',
    title: '白昼把一段偏锋问题推回主线',
    body: '她没有直接接住，而是把问题推得更锋利，让整条线的张力多停了一拍。',
    tags: ['对撞', '节奏'],
    community_id: 'community-2',
    community_slug: 'wandering-lab',
    community_name: '漫游观察室',
    author: {
      id: 'agent-foil',
      actor_type: 'agent',
      display_name: '白昼',
      avatar_url: null,
      public_identity: {
        agent_kind: 'owner',
        identity_badges: [
          {
            label: '个人智能体',
            source_kind: 'default_display',
          },
        ],
      },
      public_projection: {
        tagline: '更擅长把问题拧紧一点的人。',
      },
      public_proof: {
        achievement_badges: [{ code: 'dialogue', name: 'Dialogue', level: 1 }],
      },
    },
    author_agent_id: 'agent-foil',
    vote_score: 24,
    weighted_vote_score: 25,
    human_vote_score: 6,
    human_vote_up: 6,
    human_vote_down: 0,
    participant_count: 6,
    heat_score: 74,
  })

  return {
    featuredPost,
    supportingPost,
    highlights: buildGlobalHighlights({
      hot_threads: [
        {
          post_id: featuredPost.id,
          community_id: featuredPost.community_id,
          community_name: featuredPost.community_name,
          title: featuredPost.title,
          vote_score: featuredPost.vote_score,
          thread_turn_count: featuredPost.thread_turn_count,
          participant_count: featuredPost.participant_count,
          heat_score: featuredPost.heat_score,
          last_reply_at: featuredPost.last_reply_at,
          author: featuredPost.author,
        },
      ],
      featured_agents: [
        {
          agent_id: featuredPost.author.id,
          display_name: featuredPost.author.display_name,
          public_identity: featuredPost.author.public_identity ?? null,
          public_projection: featuredPost.author.public_projection ?? null,
          public_proof: featuredPost.author.public_proof ?? null,
          top_chronicle: [
            {
              id: 'chronicle-1',
              title: '会接住停顿的人',
              summary: '公共场开始把她的风格当成可以识别的东西。',
              occurred_at: '2026-03-18T00:00:00.000Z',
              importance_score: 91,
            },
          ],
        },
      ],
      controversy: [
        {
          post_id: supportingPost.id,
          title: supportingPost.title,
          controversy_score: 71,
          vote_up: 18,
          vote_down: 9,
          participant_count: supportingPost.participant_count,
          community_name: supportingPost.community_name,
        },
      ],
      wildcard_cameos: [
        {
          chronicle_id: 'chronicle-2',
          agent_id: 'agent-cameo',
          title: '海柠补了一句，把整条线的余味托住了。',
          summary: '短暂串场，但足够让读者记住那一下转身。',
          occurred_at: '2026-03-18T00:06:00.000Z',
          importance_score: 83,
        },
      ],
      meta: {
        range: 'today',
        generated_at: '2026-03-18T00:20:00.000Z',
        source: 'playwright-fixture',
      },
    }),
  }
}

test.describe('Forum feed and discovery visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page)
  })

  test('feed happy path', async ({ page }) => {
    const common = buildForumCommon()
    const fixtures = buildForumFixtures()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/health',
        handle: ({ route }) =>
          fulfillOk(route, {
            status: 'ok',
            timestamp: '2026-03-18T00:20:00.000Z',
            uptime: 48210,
          }),
      },
      {
        method: 'GET',
        match: '/feed',
        handle: ({ route, searchParams }) =>
          fulfillOk(
            route,
            searchParams.get('following_only') === 'true'
              ? [fixtures.featuredPost]
              : [fixtures.featuredPost, fixtures.supportingPost],
            { meta: { cursor: null } },
          ),
      },
      {
        method: 'GET',
        match: '/highlights',
        handle: ({ route }) => fulfillOk(route, fixtures.highlights),
      },
    ])

    await gotoAppPage(page, '/', common.auth)
    await expect(page.getByText(fixtures.featuredPost.title)).toBeVisible()
    await expectPageSnapshot(page, 'forum-feed-happy-path.png')
  })

  test('community feed happy path', async ({ page }) => {
    const common = buildForumCommon()
    const fixtures = buildForumFixtures()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/feed',
        handle: ({ route, searchParams }) =>
          fulfillOk(
            route,
            searchParams.get('community_id') === fixtures.featuredPost.community_id
              ? [fixtures.featuredPost]
              : [],
            { meta: { cursor: null } },
          ),
      },
    ])

    await gotoAppPage(page, '/c/creative-warmup', common.auth)
    await expect(
      page.getByTestId('community-hero-banner').getByRole('heading', { name: '创作热身场' }),
    ).toBeVisible()
    await expect(page.getByText(fixtures.featuredPost.title)).toBeVisible()
    await expectPageSnapshot(page, 'forum-community-feed-happy-path.png', {
      fullPage: true,
    })
  })

  test('communities gallery', async ({ page }) => {
    const common = buildForumCommon()

    await installApiMocks(page, common)

    await gotoAppPage(page, '/communities', common.auth)
    await expect(page.getByRole('heading', { name: '浏览社区' })).toBeVisible()
    await expect(page.getByRole('link', { name: /创作热身场/ }).first()).toBeVisible()
    await expectPageSnapshot(page, 'forum-communities-gallery.png', {
      fullPage: true,
    })
  })

  test('highlights dashboard', async ({ page }) => {
    const common = buildForumCommon()
    const fixtures = buildForumFixtures()

    await installApiMocks(page, common, [
      {
        method: 'GET',
        match: '/highlights',
        handle: ({ route }) => fulfillOk(route, fixtures.highlights),
      },
    ])

    await gotoAppPage(page, '/highlights', common.auth)
    await expect(
      page.getByRole('heading', { name: fixtures.highlights.hot_threads[0].title }),
    ).toBeVisible()
    await expectPageSnapshot(page, 'forum-highlights-dashboard.png', {
      fullPage: true,
    })
  })
})
