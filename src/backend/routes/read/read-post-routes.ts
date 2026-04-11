import type { IRouter } from 'express'
import {
  communityRepo,
  forumReadService,
  guidanceOrchestrator,
  roleAssignmentService,
} from '../../container.js'
import { config } from '../../lib/config.js'
import { trackGuidanceEventFromRequest } from '../../guidance/http.js'
import { tryAuthenticateHuman } from '../../middleware/human-auth.js'
import { resolveStageSpecFromRules } from '../../stage/index.js'
import {
  buildAftershowSnapshot,
  buildRelationTeaser,
  readSourceContext,
  readStorylineId,
  readViewerSemanticFields,
  recordPublicViewEvents,
  resolveViewerContext,
  serializePublicPost,
} from './read-route-helpers.js'

export function registerReadPostRoutes(router: IRouter): void {
  router.get('/posts/:postId', async (req, res) => {
    const user = tryAuthenticateHuman(req)
    const viewer = await resolveViewerContext(req, res)
    const sourceContext = readSourceContext(req)
    const post = await forumReadService.getPost(req.params.postId, user?.userId)
    const relationTeaser = await buildRelationTeaser(post.author.id, viewer)
    if (!config.launch.capabilities.audienceAftershowWebV1) {
      await recordPublicViewEvents([{
        actor_type: viewer.actor_type,
        actor_id: viewer.actor_id,
        viewer_user_id: viewer.user_id ?? null,
        viewer_agent_id: viewer.viewer_agent_id ?? null,
        source_surface: sourceContext.source_surface ?? 'post_detail',
        source_shelf: sourceContext.source_shelf,
        source_position: sourceContext.source_position,
        target_kind: 'post_detail',
        target_id: post.id,
        target_agent_id: post.author.id,
        community_id: post.community_id,
        storyline_id: readStorylineId(post),
        ...readViewerSemanticFields(post),
      }])
      await trackGuidanceEventFromRequest(
        req,
        res,
        guidanceOrchestrator,
        'POST_VIEWED',
        { post_id: post.id, author_agent_id: post.author_agent_id },
        { dedup_key: `post_viewed:${post.id}` },
      )
      res.json({ data: { ...serializePublicPost(post), relation_teaser: relationTeaser } })
      return
    }

    const aftershow = config.launch.capabilities.aftershowV1
      ? await buildAftershowSnapshot(post.id, { post, viewer })
      : {
          post_id: post.id,
          aftershow_summary: null,
          aftershow_callouts: [],
          audience_thread_meta: null,
        }

    await trackGuidanceEventFromRequest(
      req,
      res,
      guidanceOrchestrator,
      'POST_VIEWED',
      { post_id: post.id, author_agent_id: post.author_agent_id },
      { dedup_key: `post_viewed:${post.id}` },
    )
    await recordPublicViewEvents([{
      actor_type: viewer.actor_type,
      actor_id: viewer.actor_id,
      viewer_user_id: viewer.user_id ?? null,
      viewer_agent_id: viewer.viewer_agent_id ?? null,
      source_surface: sourceContext.source_surface ?? 'post_detail',
      source_shelf: sourceContext.source_shelf,
      source_position: sourceContext.source_position,
      target_kind: 'post_detail',
      target_id: post.id,
      target_agent_id: post.author.id,
      community_id: post.community_id,
      storyline_id: readStorylineId(post),
      ...readViewerSemanticFields(post),
    }])
    res.json({
      data: {
        ...serializePublicPost(post),
        relation_teaser: relationTeaser,
        aftershow_summary: aftershow.aftershow_summary,
        aftershow_callouts: aftershow.aftershow_callouts,
        ...(aftershow.audience_thread_meta
          ? { audience_thread_meta: aftershow.audience_thread_meta }
          : {}),
      },
    })
  })

  router.get('/posts/:postId/aftershow', async (req, res) => {
    if (!config.launch.capabilities.aftershowV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Aftershow API is disabled by feature flag.' },
      })
      return
    }

    const postId = String(req.params.postId)
    const viewer = await resolveViewerContext(req, res)
    const sourceContext = readSourceContext(req)
    const snapshot = await buildAftershowSnapshot(postId, { viewer })
    await recordPublicViewEvents([{
      actor_type: viewer.actor_type,
      actor_id: viewer.actor_id,
      viewer_user_id: viewer.user_id ?? null,
      viewer_agent_id: viewer.viewer_agent_id ?? null,
      source_surface: sourceContext.source_surface ?? 'aftershow',
      source_shelf: sourceContext.source_shelf,
      source_position: sourceContext.source_position,
      target_kind: 'aftershow_detail',
      target_id: snapshot.post_id,
      target_agent_id: null,
      community_id: null,
      storyline_id: readStorylineId(snapshot),
      ...readViewerSemanticFields(snapshot),
    }])
    res.json({ data: snapshot })
  })

  router.get('/posts/:postId/aside-seats', async (req, res) => {
    if (!config.launch.capabilities.roleAssignmentV1) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Role assignment API is disabled by feature flag.' },
      })
      return
    }

    const post = await forumReadService.getPost(String(req.params.postId))
    const community = communityRepo.findById(post.community_id)
    const stageResolved = resolveStageSpecFromRules(community?.rules_json ?? null, {
      community_id: post.community_id,
    })

    const seats = roleAssignmentService.listAsideSeatsByPost(post.id)
    res.json({
      data: {
        post_id: post.id,
        seats,
        stage_limits: {
          capacity: stageResolved.stage_spec.allocator.thread_max_agents,
          cooldown_seconds: stageResolved.stage_spec.allocator.cooldown_seconds,
        },
      },
    })
  })
}
