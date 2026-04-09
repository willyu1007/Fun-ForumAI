import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgentLink } from '@/features/agents/components/AgentLink'
import { AgentHoverCard } from '@/features/agents/components/AgentHoverCard'
import { useParams, Link, useSearchParams } from 'react-router'
import { ArrowLeft, MessageCircle, MoreHorizontal } from 'lucide-react'
import {
  usePost,
  useThreadSummaries,
  useAudienceThread,
  useCreateAudienceMessage,
  useCreatePublicThread,
  useCreatePublicTurn,
  useAftershow,
  useAsideSeats,
  useAgentProfile,
  useCreateAppeal,
  useCreateReport,
  useDiscussionForest,
  usePostParticipationContract,
  useRecordForumWatchTelemetry,
} from '@/api/hooks'
import type { AftershowSnapshot } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModerationBadge } from '../components/ModerationBadge'
import { ThreadList } from '../components/ThreadList'
import { DiscussionForest } from '../components/DiscussionForest'
import { NewContentBanner } from '../components/NewContentBanner'
import { HumanVoteControls } from '../components/HumanVoteControls'
import { SharePopover } from '../components/SharePopover'
import { PostMediaGallery } from '../components/PostMediaGallery'
import { AgentSentimentBar } from '../components/AgentSentimentBar'
import { relativeTime } from '@/shared/utils/relative-time'
import { useSseNewCounts } from '@/api/use-sse'
import { useAuth } from '@/shared/hooks/use-auth'
import { SHOULD_RENDER_DEV_AUTH_TOOLBAR } from '@/shared/layout/dev-auth-toolbar'
import { RichTextLite } from '@/shared/components/RichTextLite'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { isFrontendFlagEnabled } from '@/shared/config/frontend-flags'
import {
  describeTopicSignals,
  HOT_TOPIC_DISTRIBUTION_LABELS,
  readTopicSignals,
} from '@/shared/utils/hot-topic-policy'
import { RelationTeaserCard } from '@/features/agents/components/RelationTeaserCard'
import { readAuthorBadgeChips } from '@/shared/utils/public-author'

interface AftershowContentHighlightV1 {
  audience_message_id: string
  user_id: string
  excerpt: string
}

interface AftershowContentV1 {
  title: string
  summary: string
  highlights: AftershowContentHighlightV1[]
  generated_at: string
}

interface RailHighlightItem {
  id: string
  label: string
  body: string
}

const DESKTOP_BREAKPOINT = 1024

function isAudienceAftershowWebEnabled() {
  return isFrontendFlagEnabled('VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1')
}

function isAudienceZoneEnabled(audienceAftershowWebEnabled: boolean) {
  return audienceAftershowWebEnabled && isFrontendFlagEnabled('VITE_FF_AUDIENCE_ZONE_V1')
}

function isAftershowEnabled(audienceAftershowWebEnabled: boolean) {
  return audienceAftershowWebEnabled && isFrontendFlagEnabled('VITE_FF_AFTERSHOW_V1')
}

function isAsideSeatsEnabled(audienceAftershowWebEnabled: boolean) {
  return audienceAftershowWebEnabled && isFrontendFlagEnabled('VITE_FF_ROLE_ASSIGNMENT_V1')
}

function toAftershowContentV1(
  value: Record<string, unknown> | null | undefined,
): AftershowContentV1 | null {
  if (!value) return null
  const title = typeof value.title === 'string' ? value.title : null
  const summary = typeof value.summary === 'string' ? value.summary : null
  const generatedAt = typeof value.generated_at === 'string' ? value.generated_at : null
  const highlights = Array.isArray(value.highlights)
    ? value.highlights
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const audienceMessageId =
            typeof item.audience_message_id === 'string' ? item.audience_message_id : null
          const userId = typeof item.user_id === 'string' ? item.user_id : null
          const excerpt = typeof item.excerpt === 'string' ? item.excerpt : null
          if (!audienceMessageId || !userId || !excerpt) return null
          return {
            audience_message_id: audienceMessageId,
            user_id: userId,
            excerpt,
          } satisfies AftershowContentHighlightV1
        })
        .filter((item): item is AftershowContentHighlightV1 => item !== null)
    : []
  if (!title || !summary || !generatedAt) return null
  return {
    title,
    summary,
    highlights,
    generated_at: generatedAt,
  }
}

function hasMeaningfulAftershowSnapshot(snapshot: AftershowSnapshot | null | undefined) {
  if (!snapshot) return false
  return Boolean(
    snapshot.aftershow_summary
    || snapshot.relation_teaser
    || snapshot.aftershow_callouts.length > 0
    || ((snapshot.audience_thread_meta?.message_count ?? 0) > 0),
  )
}

function readIsDesktopLayout() {
  if (typeof window === 'undefined') return true
  return window.innerWidth >= DESKTOP_BREAKPOINT
}

function useIsDesktopLayout() {
  const [isDesktopLayout, setIsDesktopLayout] = useState(readIsDesktopLayout)

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopLayout(readIsDesktopLayout())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isDesktopLayout
}

export function PostDetailPage() {
  const { isAuthenticated, user } = useAuth()
  const { postId } = useParams()
  const audienceAftershowWebEnabled = isAudienceAftershowWebEnabled()
  const audienceZoneEnabled = isAudienceZoneEnabled(audienceAftershowWebEnabled)
  const aftershowEnabled = isAftershowEnabled(audienceAftershowWebEnabled)
  const asideSeatsEnabled = isAsideSeatsEnabled(audienceAftershowWebEnabled)
  const [searchParams] = useSearchParams()
  const parsedSourcePosition = (() => {
    const raw = searchParams.get('source_position')
    if (!raw) return undefined
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  })()
  const viewSourceParams = useMemo(
    () => ({
      ...(searchParams.get('viewer_agent_id') ? { viewer_agent_id: searchParams.get('viewer_agent_id') ?? undefined } : {}),
      ...(searchParams.get('source_surface') ? { source_surface: searchParams.get('source_surface') ?? undefined } : {}),
      ...(searchParams.get('source_shelf') ? { source_shelf: searchParams.get('source_shelf') ?? undefined } : {}),
      ...(typeof parsedSourcePosition === 'number' ? { source_position: parsedSourcePosition } : {}),
    }),
    [parsedSourcePosition, searchParams],
  )
  const hasViewSourceParams = Object.keys(viewSourceParams).length > 0
  const isDesktopLayout = useIsDesktopLayout()
  const [audienceDraft, setAudienceDraft] = useState('')
  const [audienceDraftError, setAudienceDraftError] = useState<string | null>(null)
  const [audienceDraftNotice, setAudienceDraftNotice] = useState<string | null>(null)
  const [publicReplyDraft, setPublicReplyDraft] = useState('')
  const [publicReplyError, setPublicReplyError] = useState<string | null>(null)
  const [publicReplyNotice, setPublicReplyNotice] = useState<string | null>(null)
  const [safetyActionMessage, setSafetyActionMessage] = useState<string | null>(null)
  const [stageView, setStageView] = useState<'forest' | 'timeline'>('forest')
  const [mobileTab, setMobileTab] = useState<'stage' | 'audience'>(() =>
    searchParams.get('aftershow_id') || searchParams.get('audience_message_id')
      ? 'audience'
      : 'stage',
  )
  const { data: postData, isLoading: postLoading, error: postError } = usePost(postId ?? '', viewSourceParams)
  const postPayload = postData?.data ?? null
  const authorAgentId = postPayload?.author.id ?? ''
  const authorProfile = useAgentProfile(authorAgentId)
  const { data: participationContractData } = usePostParticipationContract(postId ?? '', {
    enabled: postPayload !== null,
  })
  const focusedThreadIdFromQuery = searchParams.get('threadId')
  const focusedTurnIdFromQuery = searchParams.get('turnId')
  const { data: forestData, isLoading: forestLoading } = useDiscussionForest(
    postId ?? '',
    {
      focus_thread_id: focusedThreadIdFromQuery ?? null,
      focus_turn_id: focusedTurnIdFromQuery ?? null,
    },
    { enabled: true },
  )
  const { data: threadSummariesData, isLoading: threadSummariesLoading } = useThreadSummaries(
    postId ?? '',
    { limit: 100 },
    { enabled: stageView === 'timeline' },
  )
  const { data: audienceThreadData } = useAudienceThread(postId ?? '', {
    enabled:
      postPayload !== null
      && audienceZoneEnabled
      && Boolean(participationContractData?.data?.audience_lane?.enabled),
  })
  const { data: aftershowData } = useAftershow(
    postId ?? '',
    hasViewSourceParams
      ? {
          enabled: postPayload !== null && aftershowEnabled,
          params: viewSourceParams,
        }
      : {
          enabled: postPayload !== null && aftershowEnabled,
        },
  )
  const { data: asideSeatsData } = useAsideSeats(postId ?? '', {
    enabled: postPayload !== null && asideSeatsEnabled,
  })
  const createAudienceMessage = useCreateAudienceMessage(postId ?? '')
  const createPublicThread = useCreatePublicThread(postId ?? '')
  const createPublicTurn = useCreatePublicTurn()
  const createReport = useCreateReport()
  const createAppeal = useCreateAppeal()
  const watchTelemetry = useRecordForumWatchTelemetry(postId ?? '')
  const guideRenderRef = useRef<string | null>(null)
  const previousStageViewRef = useRef<'forest' | 'timeline'>('forest')
  const { newThreadTurnCounts, clearNewThreadTurns } = useSseNewCounts()
  const newThreadTurnCount = (postId && newThreadTurnCounts[postId]) || 0
  const audienceThread =
    audienceZoneEnabled && Boolean(participationContractData?.data?.audience_lane?.enabled)
      ? audienceThreadData?.data ?? null
      : null
  const audienceThreadMessages = audienceThread?.messages
  const asideSeatsPayload = asideSeatsEnabled ? asideSeatsData?.data ?? null : null
  const asideSeatItems = asideSeatsPayload?.seats
  const aftershow = useMemo(() => {
    if (!audienceAftershowWebEnabled) return null
    return hasMeaningfulAftershowSnapshot(aftershowData?.data) ? aftershowData.data : null
  }, [aftershowData?.data, audienceAftershowWebEnabled])
  const audienceMessages = useMemo(() => {
    return audienceThreadMessages ?? []
  }, [audienceThreadMessages])
  const asideSeats = useMemo(() => {
    return asideSeatItems ?? []
  }, [asideSeatItems])
  const aftershowContent = useMemo(
    () => toAftershowContentV1(aftershow?.aftershow_summary?.content ?? null),
    [aftershow?.aftershow_summary?.content],
  )
  const threadSummaries = useMemo(() => threadSummariesData?.data ?? [], [threadSummariesData?.data])
  const forest = useMemo(() => forestData?.data ?? null, [forestData?.data])
  const participationContract = participationContractData?.data ?? null
  const stageOpenReplyPolicy = participationContract?.stage_open_reply ?? null
  const audienceLanePolicy = participationContract?.audience_lane ?? null
  const openReplyEnabled = stageOpenReplyPolicy?.enabled ?? false
  const stageThreadEntryEnabled = stageOpenReplyPolicy?.new_thread_enabled ?? false
  const stageTurnReplyEnabled = stageOpenReplyPolicy?.turn_reply_enabled ?? false
  const [selectedForestNodeId, setSelectedForestNodeId] = useState<string | null>(
    focusedTurnIdFromQuery ?? focusedThreadIdFromQuery ?? null,
  )
  const [composerAnchorNodeId, setComposerAnchorNodeId] = useState<string | null>(null)
  const stageFocus = useMemo(() => {
    return {
      threadId: forest?.focus_thread_id ?? focusedThreadIdFromQuery ?? null,
      turnId: forest?.focus_turn_id ?? focusedTurnIdFromQuery ?? null,
    }
  }, [forest?.focus_thread_id, forest?.focus_turn_id, focusedThreadIdFromQuery, focusedTurnIdFromQuery])
  const selectedForestNode = useMemo(
    () => forest?.nodes.find((node) => node.id === selectedForestNodeId) ?? null,
    [forest?.nodes, selectedForestNodeId],
  )
  const branchGroupByThreadId = useMemo(() => {
    if (!forest) return new Map<string, NonNullable<typeof forest>['branch_groups'][number]>()
    return new Map(forest.branch_groups.map((group) => [group.thread_id, group]))
  }, [forest])
  const explicitComposerAnchorNode = useMemo(
    () => forest?.nodes.find((node) => node.id === composerAnchorNodeId) ?? null,
    [composerAnchorNodeId, forest?.nodes],
  )
  const selectedForestGroup = selectedForestNode
    ? branchGroupByThreadId.get(selectedForestNode.thread_id) ?? null
    : null
  const selectedForestWriteability = selectedForestGroup?.lifecycle?.writeability ?? null
  const selectedForestRouteCtaLabel =
    typeof selectedForestGroup?.lifecycle?.active_route?.cta?.label === 'string'
      ? selectedForestGroup.lifecycle.active_route.cta.label
      : null
  const isThreadReplyable = useCallback((threadId: string | null | undefined) => {
    if (!threadId) return false
    const group = branchGroupByThreadId.get(threadId)
    return group?.lifecycle?.writeability.reply_allowed ?? false
  }, [branchGroupByThreadId])
  const composerAnchorNode = useMemo(() => {
    if (!stageTurnReplyEnabled) {
      return null
    }
    if (explicitComposerAnchorNode && isThreadReplyable(explicitComposerAnchorNode.thread_id)) {
      return explicitComposerAnchorNode
    }
    if (!stageThreadEntryEnabled && selectedForestNode && isThreadReplyable(selectedForestNode.thread_id)) {
      return selectedForestNode
    }
    return null
  }, [
    explicitComposerAnchorNode,
    isThreadReplyable,
    selectedForestNode,
    stageThreadEntryEnabled,
    stageTurnReplyEnabled,
  ])
  const canClearComposerAnchor = Boolean(
    composerAnchorNodeId
    && stageTurnReplyEnabled
    && stageThreadEntryEnabled,
  )
  const recordWatchTelemetry = useCallback((input: {
    event_type: 'guide_render' | 'guide_click' | 'branch_expand' | 'node_focus' | 'timeline_open' | 'reply_anchor_select'
    thread_id?: string
    turn_id?: string
    branch_group_id?: string
    source_surface?: string
    source_shelf?: string
  }) => {
    if (!postId) return
    watchTelemetry.mutate({
      ...input,
      source_surface: input.source_surface ?? 'post_detail',
      source_shelf: input.source_shelf ?? stageView,
    })
  }, [postId, stageView, watchTelemetry])
  const timelineFocus = useMemo(() => {
    if (selectedForestNode) {
      return {
        threadId: selectedForestNode.thread_id,
        turnId: selectedForestNode.entry_kind === 'TURN' ? selectedForestNode.id : null,
      }
    }
    return stageFocus
  }, [selectedForestNode, stageFocus])
  const focusedAftershowId = searchParams.get('aftershow_id')
  const focusedCalloutIndexRaw = searchParams.get('callout_index')
  const focusedCalloutIndex = focusedCalloutIndexRaw
    ? Number.parseInt(focusedCalloutIndexRaw, 10)
    : null
  const focusedAudienceMessageIdFromQuery = searchParams.get('audience_message_id')
  const focusedCallout = useMemo(() => {
    if (
      !aftershow ||
      !focusedAftershowId ||
      focusedCalloutIndex === null ||
      Number.isNaN(focusedCalloutIndex) ||
      focusedCalloutIndex < 0
    ) {
      return null
    }
    return (
      aftershow.aftershow_callouts.find(
        (item, index) => item.artifact_id === focusedAftershowId && index === focusedCalloutIndex,
      ) ?? null
    )
  }, [aftershow, focusedAftershowId, focusedCalloutIndex])
  const focusedAudienceMessageId =
    focusedAudienceMessageIdFromQuery || focusedCallout?.audience_message_id || null
  const renderedAudienceMessages = useMemo(() => {
    const recentMessages = audienceMessages.slice(-20)
    if (!focusedAudienceMessageId) return recentMessages
    if (recentMessages.some((message) => message.id === focusedAudienceMessageId))
      return recentMessages
    const focusedMessage = audienceMessages.find(
      (message) => message.id === focusedAudienceMessageId,
    )
    if (!focusedMessage) return recentMessages
    return [focusedMessage, ...recentMessages]
  }, [audienceMessages, focusedAudienceMessageId])
  const audienceHighlights = useMemo<RailHighlightItem[]>(() => {
    if (aftershowContent?.highlights.length) {
      return aftershowContent.highlights.slice(0, 3).map((highlight) => ({
        id: highlight.audience_message_id,
        label: `用户 ${highlight.user_id.slice(0, 8)}`,
        body: highlight.excerpt,
      }))
    }

    return (aftershow?.aftershow_callouts ?? []).slice(0, 3).map((callout, index) => ({
      id: callout.id,
      label: `亮点 ${index + 1}`,
      body: callout.reason,
    }))
  }, [aftershow?.aftershow_callouts, aftershowContent])

  useEffect(() => {
    if (!focusedAudienceMessageId) {
      return
    }
    if (!renderedAudienceMessages.some((item) => item.id === focusedAudienceMessageId)) {
      return
    }
    const element = document.getElementById(`audience-message-${focusedAudienceMessageId}`)
    if (!element) return
    element.classList.add('border-primary', 'bg-muted/30')
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = window.setTimeout(() => {
      element.classList.remove('border-primary', 'bg-muted/30')
    }, 2500)
    return () => {
      window.clearTimeout(timer)
      element.classList.remove('border-primary', 'bg-muted/30')
    }
  }, [focusedAudienceMessageId, renderedAudienceMessages, mobileTab])

  useEffect(() => {
    const nextFocusedId = focusedTurnIdFromQuery ?? focusedThreadIdFromQuery ?? null
    if (nextFocusedId) {
      setSelectedForestNodeId(nextFocusedId)
    }
  }, [focusedThreadIdFromQuery, focusedTurnIdFromQuery])

  useEffect(() => {
    if (!forest || forest.reading_guide.entries.length === 0) {
      return
    }
    const telemetryKey = `${postId ?? 'unknown'}:${forest.generated_at}`
    if (guideRenderRef.current === telemetryKey) {
      return
    }
    guideRenderRef.current = telemetryKey
    recordWatchTelemetry({
      event_type: 'guide_render',
      thread_id: forest.reading_guide.entries[0]?.thread_id,
      turn_id: forest.reading_guide.entries[0]?.focus_turn_id ?? undefined,
      source_shelf: 'forest',
    })
  }, [forest, postId, recordWatchTelemetry])

  useEffect(() => {
    const previous = previousStageViewRef.current
    if (previous !== stageView && stageView === 'timeline') {
      recordWatchTelemetry({ event_type: 'timeline_open', source_shelf: 'timeline' })
    }
    previousStageViewRef.current = stageView
  }, [recordWatchTelemetry, stageView])

  useEffect(() => {
    if (selectedForestNodeId || !forest) {
      return
    }
    const firstGuideNodeId = forest.reading_guide.entries[0]?.focus_turn_id
      ?? forest.reading_guide.entries[0]?.thread_id
      ?? forest.nodes[0]?.id
      ?? null
    if (firstGuideNodeId) {
      setSelectedForestNodeId(firstGuideNodeId)
    }
  }, [forest, selectedForestNodeId])

  useEffect(() => {
    if (!composerAnchorNodeId) {
      return
    }
    if (!stageTurnReplyEnabled) {
      setComposerAnchorNodeId(null)
      return
    }
    const anchorExists = forest?.nodes.some((node) => node.id === composerAnchorNodeId) ?? false
    if (!anchorExists) {
      setComposerAnchorNodeId(null)
    }
  }, [composerAnchorNodeId, forest?.nodes, stageTurnReplyEnabled])

  if (postLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 rounded-md" />
      </div>
    )
  }

  if (postError || !postData?.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">← 返回广场</Link>
        </Button>
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          未找到该帖子。
        </div>
      </div>
    )
  }

  const post = postData.data
  const author = post.author
  const isPostOwner = authorProfile.data?.data?.owner_id === user?.id
  const topicSignals = readTopicSignals(post.topic_signals)
  const topicTransparencyCopy = describeTopicSignals(topicSignals, post.distribution_state)
  const hasAudienceRail =
    audienceAftershowWebEnabled && Boolean(audienceThread || aftershow || asideSeats.length > 0)
  const canUseAudienceComposer =
    audienceZoneEnabled
    && Boolean(audienceLanePolicy?.posting_enabled)
  const summaryTitle = aftershowContent?.title ?? null
  const summaryText = aftershowContent?.summary ?? aftershow?.aftershow_summary?.summary_text ?? null
  const summaryTimestamp =
    aftershow?.aftershow_summary?.published_at ?? aftershowContent?.generated_at ?? null
  const { identityChip: authorIdentityChip, proofChips: authorProofChips } = readAuthorBadgeChips(author, {
    maxProofChips: 2,
    policyId: 'public_author_medium',
  })
  const distributionNotice =
    post.distribution_state !== 'NORMAL' || topicSignals?.driftDetected || topicSignals?.hotTopicFlag
      ? topicTransparencyCopy ??
        `当前帖子分发状态为 ${HOT_TOPIC_DISTRIBUTION_LABELS[post.distribution_state] ?? post.distribution_state}。`
      : null
  const audienceComposerPlaceholder = !isAuthenticated
    ? '登录后可参与观众区'
    : canUseAudienceComposer
      ? '留下你的观众留言…'
      : audienceLanePolicy?.posting_enabled === false
        ? '当前帖子暂不开放观众留言'
        : '观众区暂未准备好'
  const authorAvatarSrc = resolveAgentAvatarSrc({
    id: author.id,
    display_name: author.display_name,
    avatar_url: author.avatar_url,
  })

  const handleSendAudienceMessage = async () => {
    const body = audienceDraft.trim()
    if (!canUseAudienceComposer || !body || !postId || createAudienceMessage.isPending) return
    try {
      setAudienceDraftError(null)
      const result = await createAudienceMessage.mutateAsync({
        body,
        idempotency_key: `viewer-audience:${postId}:${Date.now()}`,
        source_context: {
          discovered_via: 'discussion_forest',
          source_surface: 'post_detail',
          source_shelf: 'audience',
        },
      })

      if (result.data.result === 'ACCEPTED') {
        setAudienceDraft('')
        setAudienceDraftNotice(result.data.message ?? '观众留言已发布。')
        return
      }
      if (result.data.result === 'PENDING_MODERATION') {
        setAudienceDraft('')
        setAudienceDraftNotice(result.data.message ?? '内容已收到，正在等待审核。')
        return
      }

      setAudienceDraftNotice(null)
      setAudienceDraftError(result.data.message ?? '发布失败，请稍后重试')
    } catch (error) {
      setAudienceDraftNotice(null)
      setAudienceDraftError(error instanceof Error ? error.message : '发布失败，请稍后重试')
    }
  }

  const handleSubmitStageReply = async () => {
    const body = publicReplyDraft.trim()
    if (!body || !postId) {
      setPublicReplyError('回复内容不能为空。')
      return
    }
    const idempotencyKey = `viewer-stage:${postId}:${Date.now()}`
    try {
      let result
      if (composerAnchorNode) {
        result = await createPublicTurn.mutateAsync({
          threadId: composerAnchorNode.thread_id,
          postId: postId,
          body,
          anchor_turn_id: composerAnchorNode.entry_kind === 'TURN' ? composerAnchorNode.id : null,
          focused_turn_id: composerAnchorNode.entry_kind === 'TURN' ? composerAnchorNode.id : null,
          actual_anchor_turn_id: composerAnchorNode.actual_anchor_turn_id
            ?? (composerAnchorNode.entry_kind === 'TURN' ? composerAnchorNode.id : null),
          quoted_excerpt: composerAnchorNode.body.slice(0, 180),
          idempotency_key: idempotencyKey,
          source_context: {
            discovered_via: 'discussion_forest',
            source_surface: 'post_detail',
            source_shelf: stageView,
          },
        })
      } else if (stageThreadEntryEnabled) {
        result = await createPublicThread.mutateAsync({
          body,
          idempotency_key: idempotencyKey,
          source_context: {
            discovered_via: forest ? 'discussion_forest' : 'timeline',
            source_surface: 'post_detail',
            source_shelf: stageView,
          },
        })
      } else {
        setPublicReplyError('当前帖子只允许从现有节点发起公开回应。')
        return
      }

      if (result.data.result === 'ACCEPTED') {
        setPublicReplyDraft('')
        setPublicReplyError(null)
        setPublicReplyNotice(result.data.message ?? '公开内容已发布。')
        return
      }
      if (result.data.result === 'PENDING_MODERATION') {
        setPublicReplyDraft('')
        setPublicReplyError(null)
        setPublicReplyNotice(result.data.message ?? '内容已收到，正在等待审核。')
        return
      }

      setPublicReplyNotice(null)
      setPublicReplyError(result.data.message ?? '提交失败，请稍后重试。')
    } catch (error) {
      setPublicReplyNotice(null)
      setPublicReplyError(error instanceof Error ? error.message : '提交失败，请稍后重试。')
    }
  }

  const handleReportPost = async () => {
    setSafetyActionMessage(null)
    try {
      await createReport.mutateAsync({
        target_type: 'post',
        target_id: post.id,
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'viewer_report',
        detail_text: `Reported from post detail: ${post.id}`,
      })
      setSafetyActionMessage('举报已提交，可在“举报与申诉”页查看处理状态。')
    } catch (error) {
      setSafetyActionMessage(error instanceof Error ? error.message : '举报提交失败，请稍后重试')
    }
  }

  const handleAppealPost = async () => {
    setSafetyActionMessage(null)
    try {
      await createAppeal.mutateAsync({
        target_type: 'post',
        target_id: post.id,
        appeal_type: 'CONTENT_APPEAL',
        reason: 'owner_appeal_from_post_detail',
      })
      setSafetyActionMessage('申诉已提交，可在“举报与申诉”页查看处理状态。')
    } catch (error) {
      setSafetyActionMessage(error instanceof Error ? error.message : '申诉提交失败，请稍后重试')
    }
  }

  const stageContent = (
    <div className="relative min-w-0 space-y-8" data-testid="post-detail-stage-content">
      <div className="mb-3 lg:absolute lg:-left-[2.125rem] lg:top-0 lg:mb-0" data-testid="post-detail-back-link-wrap">
        <Button
          variant="ghost"
          size="icon-lg"
          asChild
          className="size-11 shrink-0 rounded-full bg-muted/65 text-foreground hover:bg-muted"
        >
          <Link to="/" aria-label="返回广场">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
      </div>

      <article className="min-w-0 space-y-1 px-[25px]" data-testid="post-detail-stage-article">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="relative min-w-0 -ml-1">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-1 gap-y-0.5">
              <div
                className="row-span-2 inline-flex self-start p-0.5"
                data-testid="post-detail-author-avatar-region"
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={authorAvatarSrc} alt={author.display_name} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {author.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <AgentHoverCard agentId={author.id}>
                <AgentLink
                  agentId={author.id}
                  aria-label={author.display_name}
                  className="col-start-2 row-start-1 mt-px min-w-0 self-start text-left hover:no-underline"
                >
                  <div
                    className="flex min-w-0 items-center gap-1.5 px-1 text-xs leading-none"
                    data-testid="post-detail-author-primary-line"
                  >
                    <span className="truncate font-semibold text-foreground">{author.display_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="shrink-0 text-xs text-muted-foreground/80">{relativeTime(post.created_at)}</span>
                  </div>
                </AgentLink>
              </AgentHoverCard>
              {authorIdentityChip || authorProofChips.length > 0 ? (
                <div
                  className="col-start-2 row-start-2 min-w-0 self-start px-[0.175rem] py-0.5"
                  data-testid="post-detail-author-secondary-line"
                >
                  {authorIdentityChip ? (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {authorIdentityChip}
                    </Badge>
                  ) : null}
                  {authorProofChips.map((badge) => (
                    <Badge key={badge} variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {badge}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 pt-0.5">
            <ModerationBadge visibility={post.visibility} state={post.state} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground outline-none ring-0 hover:bg-muted/50 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">更多</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>更多操作</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAuthenticated ? (
                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      className="w-full text-left"
                      disabled={createReport.isPending}
                      onClick={() => {
                        void handleReportPost()
                      }}
                    >
                      {createReport.isPending ? '提交中…' : '举报此帖'}
                    </button>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/login">登录后举报</Link>
                  </DropdownMenuItem>
                )}
                {isPostOwner && (
                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      className="w-full text-left"
                      disabled={createAppeal.isPending}
                      onClick={() => {
                        void handleAppealPost()
                      }}
                    >
                      {createAppeal.isPending ? '提交中…' : '申诉审核'}
                    </button>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/safety">查看状态</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/help/report-appeal-delete">流程说明</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="pb-2">
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{post.title}</h1>
        </div>

        <RichTextLite
          text={post.body}
          className="text-sm leading-7 text-foreground/82"
        />

        {post.media.length > 0 && (
          <PostMediaGallery media={post.media} className="mt-4 w-full" />
        )}

        <div className="flex flex-wrap items-center gap-2 pt-4">
          <HumanVoteControls
            targetType="POST"
            targetId={post.id}
            humanUp={post.human_vote_up}
            humanDown={post.human_vote_down}
            initialDirection={post.viewer_human_vote_direction}
          />
          <Link
            to={`/posts/${post.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs tabular-nums text-primary/80 transition-colors hover:bg-primary/15 hover:text-primary"
          >
            <MessageCircle className="size-3.5" />
            {post.thread_turn_count}
          </Link>
          <SharePopover postId={post.id} postTitle={post.title} />
          <span className="flex-1" />
          <AgentSentimentBar agentUp={post.agent_vote_up} agentDown={post.agent_vote_down} />
        </div>

        {distributionNotice && (
          <p className="text-xs leading-6 text-muted-foreground">
            {distributionNotice}{' '}
            <Link to="/help/hot-topic-rules" className="underline underline-offset-4">
              查看规则
            </Link>
          </p>
        )}

        {safetyActionMessage && (
          <p
            className={
              createReport.isError || createAppeal.isError
                ? 'text-xs text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {safetyActionMessage}
          </p>
        )}
      </article>

      <section className="space-y-4 px-[25px]" data-testid="post-detail-thread-section">
        <NewContentBanner
          count={newThreadTurnCount}
          label="条新舞台发言"
          onRefresh={() => {
            if (postId) clearNewThreadTurns(postId)
          }}
          queryKey={['discussionForest', postId]}
        />
        {openReplyEnabled && (
          isAuthenticated ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {composerAnchorNode
                      ? '回应当前节点'
                      : stageThreadEntryEnabled
                        ? '发起新的公开分支'
                        : '选择一个节点后公开回应'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {composerAnchorNode
                      ? `你的发言会顺着 ${composerAnchorNode.author.display_name} 的这条${composerAnchorNode.entry_kind === 'TURN' ? '发言' : '分支开场'}继续。`
                      : stageThreadEntryEnabled && stageTurnReplyEnabled
                        ? '你的发言默认会直接进入主舞台，形成新的公开讨论分支；如果想顺着某个节点继续，请先在讨论森林里点击“回应这里”。'
                        : stageThreadEntryEnabled
                        ? '你的发言会直接进入主舞台，并形成新的公开讨论分支。'
                        : '当前帖子只开放节点内公开回应，请先在讨论森林中选中一个可回应的节点。'}
                  </p>
                </div>
                {canClearComposerAnchor ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setComposerAnchorNodeId(null)}
                  >
                    清除锚点
                  </Button>
                ) : null}
              </div>
              {composerAnchorNode ? (
                <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-background/70 px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    当前锚点 · {composerAnchorNode.author.display_name}
                  </p>
                  <RichTextLite text={composerAnchorNode.body} className="mt-1 text-xs leading-6 text-foreground/80" />
                </div>
              ) : null}
                {selectedForestNode && !composerAnchorNode ? (
                <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-background/70 px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    当前聚焦节点 · {selectedForestNode.author.display_name}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {selectedForestWriteability && !selectedForestWriteability.reply_allowed
                      ? selectedForestRouteCtaLabel
                        ? `当前聚焦节点已经转去新的续接入口，不能再沿原线程公开回复。请在分支里使用“${selectedForestRouteCtaLabel}”，或者直接发起新的公开分支。`
                        : '当前聚焦节点已经收口，不能再沿原线程公开回复；如需继续，请直接发起新的公开分支。'
                      : stageThreadEntryEnabled && stageTurnReplyEnabled
                      ? '当前聚焦节点仅用于观看；如需沿着它继续，请点击“回应这里”，否则你的发言会作为新的公开分支发布。'
                      : stageThreadEntryEnabled
                      ? '当前帖子只开放新公开分支，未开放节点内回复；你的发言会作为新的公开分支发布。'
                      : '当前帖子只开放节点内公开回应，请沿着这个节点继续。'}
                  </p>
                </div>
              ) : null}
              <Textarea
                value={publicReplyDraft}
                onChange={(event) => {
                  setPublicReplyDraft(event.target.value)
                  if (publicReplyError) setPublicReplyError(null)
                  if (publicReplyNotice) setPublicReplyNotice(null)
                }}
                placeholder={composerAnchorNode ? '顺着这个节点继续回应…' : '补充你的观点、提问，或给出新的线索…'}
                className="mt-3 min-h-[120px] resize-y text-sm"
              />
              {publicReplyError && (
                <p className="mt-2 text-xs text-destructive">{publicReplyError}</p>
              )}
              {!publicReplyError && publicReplyNotice && (
                <p className="mt-2 text-xs text-muted-foreground">{publicReplyNotice}</p>
              )}
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  disabled={
                    createPublicThread.isPending
                    || createPublicTurn.isPending
                    || (!composerAnchorNode && !stageThreadEntryEnabled)
                  }
                  onClick={() => {
                    void handleSubmitStageReply()
                  }}
                >
                  {createPublicThread.isPending || createPublicTurn.isPending
                    ? '提交中…'
                    : composerAnchorNode
                      ? '发送回应'
                      : stageThreadEntryEnabled
                        ? '发起公开回复'
                        : '先选择节点'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              登录后可加入这条公开主线程。
            </div>
          )
        )}
        <Tabs value={stageView} onValueChange={(value) => setStageView(value as 'forest' | 'timeline')}>
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="forest">讨论森林</TabsTrigger>
            <TabsTrigger value="timeline">时间线</TabsTrigger>
          </TabsList>
          <TabsContent value="forest" className="pt-4">
            <DiscussionForest
              postId={post.id}
              forest={forest}
              isLoading={forestLoading}
              selectedNodeId={selectedForestNodeId}
              replyActionLabel={stageTurnReplyEnabled ? '回应这里' : null}
              onSelectNode={(node, source) => {
                setSelectedForestNodeId(node.id)
                if (source === 'guide') {
                  recordWatchTelemetry({
                    event_type: 'guide_click',
                    thread_id: node.thread_id,
                    turn_id: node.entry_kind === 'TURN' ? node.id : undefined,
                    source_shelf: 'forest',
                  })
                  return
                }
                if (source === 'reply') {
                  if (!isThreadReplyable(node.thread_id)) {
                    setComposerAnchorNodeId(null)
                    setPublicReplyError(null)
                    const ctaLabel = typeof branchGroupByThreadId.get(node.thread_id)?.lifecycle?.active_route?.cta?.label === 'string'
                      ? branchGroupByThreadId.get(node.thread_id)?.lifecycle.active_route?.cta?.label
                      : null
                    setPublicReplyNotice(
                      ctaLabel
                        ? `这条分支已经转去新的续接入口，请使用“${ctaLabel}”。`
                        : '这条分支当前不再接受沿原线程继续公开回复。',
                    )
                    return
                  }
                  setPublicReplyNotice(null)
                  setComposerAnchorNodeId(node.id)
                  recordWatchTelemetry({
                    event_type: 'reply_anchor_select',
                    thread_id: node.thread_id,
                    turn_id: node.entry_kind === 'TURN' ? node.id : undefined,
                    source_shelf: 'forest',
                  })
                  return
                }
                setPublicReplyNotice(null)
                recordWatchTelemetry({
                  event_type: 'node_focus',
                  thread_id: node.thread_id,
                  turn_id: node.entry_kind === 'TURN' ? node.id : undefined,
                  source_shelf: 'forest',
                })
              }}
              onBranchExpand={(group) => {
                recordWatchTelemetry({
                  event_type: 'branch_expand',
                  thread_id: group.thread_id,
                  branch_group_id: group.id,
                  source_shelf: 'forest',
                })
              }}
            />
          </TabsContent>
          <TabsContent value="timeline" className="pt-4">
            <ThreadList
              summaries={threadSummaries}
              isLoading={threadSummariesLoading}
              targetThreadId={timelineFocus.threadId}
              targetTurnId={timelineFocus.turnId}
              enablePublicReplies={openReplyEnabled}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )

  const audiencePanel = (
    <div className="min-h-full px-5 pb-6 pt-5">
      <div id="aftershow-panel" className="space-y-4 border-b pb-5">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">摘要与亮点</p>
          {summaryTimestamp && (
            <p className="text-xs text-muted-foreground">更新于 {relativeTime(summaryTimestamp)}</p>
          )}
        </div>

        {summaryTitle && <h2 className="text-base font-semibold leading-snug">{summaryTitle}</h2>}

        {summaryText ? (
          <RichTextLite text={summaryText} className="text-sm leading-7" />
        ) : (
          <p className="text-sm text-muted-foreground">暂时还没有摘要，先看看观众区的讨论。</p>
        )}

        <RelationTeaserCard
          agentId={post.author.id}
          teaser={aftershow?.relation_teaser ?? post.relation_teaser}
          sourceSurface="aftershow"
          sourceShelf="aftershow_panel"
        />

        {audienceHighlights.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">亮点</p>
            <div className="space-y-3">
              {audienceHighlights.map((highlight) => (
                <div key={highlight.id} className="border-l border-border pl-3">
                  <p className="text-xs font-medium text-foreground/80">{highlight.label}</p>
                  <RichTextLite text={highlight.body} className="mt-1 text-sm leading-6" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">观众讨论</h2>
            <p className="text-xs text-muted-foreground">
              {audienceMessages.length} 条留言
              {asideSeats.length > 0 ? ` · ${asideSeats.length} 个旁观位` : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-4 pr-1">
          {audienceMessages.length === 0 ? (
            <div className="py-4 text-sm text-muted-foreground">还没有观众留言</div>
          ) : (
            renderedAudienceMessages.map((message) => (
              <div
                key={message.id}
                id={`audience-message-${message.id}`}
                className="border-l border-border pl-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    用户 {message.author_user_id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(message.created_at)}
                  </span>
                </div>
                <RichTextLite text={message.body} className="mt-1 text-sm leading-6" />
              </div>
            ))
          )}
        </div>

        <div className="mt-4 space-y-2 border-t pt-4">
          <Textarea
            id="audience-message-input"
            name="audienceMessage"
            value={audienceDraft}
            onChange={(e) => {
              setAudienceDraft(e.target.value)
              if (audienceDraftError) setAudienceDraftError(null)
              if (audienceDraftNotice) setAudienceDraftNotice(null)
            }}
            disabled={!isAuthenticated || !canUseAudienceComposer || createAudienceMessage.isPending}
            placeholder={audienceComposerPlaceholder}
            className="min-h-20 text-sm"
          />
          {audienceDraftError && <div className="text-xs text-destructive">{audienceDraftError}</div>}
          {!audienceDraftError && audienceDraftNotice && (
            <div className="text-xs text-muted-foreground">{audienceDraftNotice}</div>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={
                !isAuthenticated ||
                !canUseAudienceComposer ||
                !audienceDraft.trim() ||
                createAudienceMessage.isPending
              }
              onClick={() => {
                void handleSendAudienceMessage()
              }}
            >
              发布留言
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  const railPlaceholder = (
    <div className="min-h-full px-5 pb-6 pt-5">
      <div className="rounded-xl border border-dashed border-border/60 bg-background/55 px-4 py-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">帖子上下文区</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          观众讨论、高光摘要和剧情补充会放在这里。
        </p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 pt-2 lg:pt-4">
      {isDesktopLayout ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(18rem,1fr)] lg:gap-10">
          <div className="min-w-0">{stageContent}</div>
          <aside className="hidden min-h-0 lg:block lg:self-stretch" data-testid="post-detail-rail">
            <div
              className={
                SHOULD_RENDER_DEV_AUTH_TOOLBAR
                  ? 'sticky top-[68px] h-[calc(100vh-68px-4rem)] overflow-hidden bg-muted/70'
                  : 'sticky top-[68px] h-[calc(100vh-68px)] overflow-hidden bg-muted/70'
              }
              data-testid="post-detail-rail-shell"
            >
              <div className="h-full overflow-y-auto border-l border-border/45">
                {hasAudienceRail ? audiencePanel : railPlaceholder}
              </div>
            </div>
          </aside>
        </div>
      ) : hasAudienceRail ? (
        <Tabs value={mobileTab} onValueChange={(value) => setMobileTab(value as 'stage' | 'audience')}>
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="stage">舞台</TabsTrigger>
            <TabsTrigger value="audience">观众区</TabsTrigger>
          </TabsList>
          <TabsContent value="stage" className="pt-4">
            {stageContent}
          </TabsContent>
          <TabsContent value="audience" className="pt-4">
            {audiencePanel}
          </TabsContent>
        </Tabs>
      ) : (
        stageContent
      )}
    </div>
  )
}
