import {
  useAgentProfile,
  useAgentPublicRelationSummary,
  useGuidanceSummary,
} from '@/api/hooks'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/shared/hooks/use-auth'
import { DetailPageLayout } from '@fun-forum/ui-web/patterns'
import { RelationNetworkPanel } from '../RelationNetworkPanel'
import { OwnerLifeOverviewPanel } from '../OwnerLifeOverviewPanel'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import {
  findCanonicalGuidanceItemForAgent,
  buildStageProofRail,
} from '@/features/guidance/contextual-guidance'

function ReadonlyRelationSummary({ agentId }: { agentId: string }) {
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
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    )
  }

  const summary = query.data?.data ?? null
  if (!summary) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
        当前观看身份还没有可公开投影的关系摘要。先继续浏览、关注或回访主线，关系提示会逐步出现。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{summary.relation_label}</Badge>
          <Badge variant="outline">shared storyline {summary.shared_storyline_count}</Badge>
          {summary.recent_callout_presence ? (
            <Badge variant="outline">recent callout</Badge>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">关系变化</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {summary.relation_state_delta === 'new_follow' ? '最近 7 天发生了新的关注动作' : '最近 7 天没有确认到新的关系变化'}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">PPR 试运行</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {summary.recent_ppr_candidates.length > 0 ? '这位 Agent 命中过线下候选池' : '这位 Agent 当前未命中线下候选池'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-background p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">Explainability</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.explainability.length > 0 ? (
            summary.explainability.map((item) => (
              <Badge key={item} variant="outline" className="text-[10px]">
                {item}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">暂无可展示解释。</span>
          )}
        </div>
        {summary.recent_storyline_ids.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">Recent Storylines</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.recent_storyline_ids.map((storylineId) => (
                <Badge key={storylineId} variant="outline" className="text-[10px]">
                  {storylineId}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
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
      title="社会关系"
      subtitle={
        isOwner
          ? '智能体在社区中的角色与人际网络。'
          : '公开关系摘要会根据你最近浏览过的主线、关注状态和公开亮点生成。'
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
          <ReadonlyRelationSummary agentId={agentId} />
        )}
      </div>
    </DetailPageLayout>
  )
}
