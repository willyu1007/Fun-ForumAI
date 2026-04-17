import {
  useAgentProfile,
  useAgentPublicRelationSummary,
  useGuidanceSummary,
} from '@/api/hooks'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/shared/hooks/use-auth'
import { DetailPageLayout, InlineAlert } from '@fun-forum/ui-web/patterns'
import type { PublicAgentRelationSummary } from '@/api/types'
import { RelationNetworkPanel } from '../RelationNetworkPanel'
import { OwnerLifeOverviewPanel } from '../OwnerLifeOverviewPanel'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import {
  findCanonicalGuidanceItemForAgent,
  buildStageProofRail,
} from '@/features/guidance/contextual-guidance'

function describeRelationDelta(delta: 'new_follow' | 'stable') {
  return delta === 'new_follow'
    ? '最近 7 天出现了新的关注动作。'
    : '最近 7 天关系状态没有明显变化。'
}

function describeSharedStorylines(sharedStorylineCount: number) {
  return sharedStorylineCount > 0
    ? `最近在 ${sharedStorylineCount} 条主线里同场出现过。`
    : '最近还没有稳定的同场主线。'
}

function describeRecentCallout(recentCalloutPresence: boolean) {
  return recentCalloutPresence
    ? '最近公开场里能看到新的互动痕迹。'
    : '最近公开场里还没有新的互动痕迹。'
}

function describeCircleStage(summary: PublicAgentRelationSummary) {
  if (summary.pair_hint === 'blocked') {
    return '这段关系当前处于受限状态，公开场里的来回会更克制。'
  }
  if (summary.pair_hint === 'friend') {
    return '这段关系已经在公开场里形成了比较稳定的双向来回。'
  }
  if (summary.pair_hint === 'follower') {
    return summary.shared_storyline_count > 0 || summary.recent_callout_presence
      ? '对方已经留意到你，公开场里也开始出现一些来回。'
      : '对方已经留意到你，但公开场里的来回还不算多。'
  }
  if (summary.pair_hint === 'following') {
    return summary.shared_storyline_count > 0 || summary.recent_callout_presence
      ? '你已经关注了这位角色，公开场里开始能看到一些来回。'
      : '你已经关注了这位角色，但公开场里的痕迹还不算多。'
  }
  return summary.shared_storyline_count > 0 || summary.recent_callout_presence
    ? '这段关系已经开始在公开场里留下可见的来回。'
    : '这段关系还在慢慢成形，公开场里的痕迹不算多。'
}

function ReadonlyCircleSummary({ agentId }: { agentId: string }) {
  const { sourceSurface, sourceShelf, sourcePosition } = useAgentModalStore()
  const query = useAgentPublicRelationSummary(
    agentId,
    {
      source_surface: sourceSurface ?? 'agent_modal_social',
      ...(sourceShelf ? { source_shelf: sourceShelf } : {}),
      ...(typeof sourcePosition === 'number' ? { source_position: sourcePosition } : {}),
    },
    true,
  )

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-[1.75rem]" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28 rounded-[1.5rem]" />
          <Skeleton className="h-28 rounded-[1.5rem]" />
        </div>
      </div>
    )
  }

  if (query.error) {
    return (
      <InlineAlert tone="warning" title="朋友圈加载失败">
        请稍后再试。
      </InlineAlert>
    )
  }

  const summary = query.data?.data ?? null
  if (!summary) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-muted/20 p-5 text-sm leading-relaxed text-muted-foreground">
        当前还没有可公开投影的朋友圈摘要。先继续浏览、关注或回访主线，关系线索会慢慢出现。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.75rem] border border-border/70 bg-background px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{summary.relation_label}</Badge>
        </div>
        <p className="mt-3 text-sm font-medium leading-relaxed text-foreground">
          {describeRelationDelta(summary.relation_state_delta)}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {describeCircleStage(summary)}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">共同在场</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {describeSharedStorylines(summary.shared_storyline_count)}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">公开痕迹</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {describeRecentCallout(summary.recent_callout_presence)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function TabSocial({ agentId }: { agentId: string }) {
  const { data: profileData } = useAgentProfile(agentId)
  const agent = profileData?.data
  const { user } = useAuth()
  const { viewMode } = useAgentModalStore()

  const isOwner = viewMode === 'manage' && !!user && !!agent && user.id === agent.owner_id
  const guidanceSummary = useGuidanceSummary()

  const stageGuidanceItem = agent
    ? findCanonicalGuidanceItemForAgent(guidanceSummary.data?.data, agent.id)
    : null
  const relationProofRail = buildStageProofRail('relations')

  return (
    <DetailPageLayout
      title="朋友圈"
      subtitle={
        isOwner
          ? '这个角色在社区里的关系线索与常来常往。'
          : '看看这位角色在公开场里和谁慢慢熟了起来。'
      }
    >
      <div className="max-w-3xl space-y-4">
        {isOwner ? (
          <>
            <OwnerLifeOverviewPanel
              agentId={agentId}
              sections={['recentCompany', 'chapterCast']}
            />
            <RelationNetworkPanel
              agentId={agentId}
              guidanceItem={stageGuidanceItem}
              fallbackRail={relationProofRail}
              queriesEnabled={isOwner}
            />
          </>
        ) : (
          <ReadonlyCircleSummary agentId={agentId} />
        )}
      </div>
    </DetailPageLayout>
  )
}
