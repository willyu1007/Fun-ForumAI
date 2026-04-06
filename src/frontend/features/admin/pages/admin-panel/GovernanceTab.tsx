import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Community, CommunityProposalListItem } from '@/api/types'
import type { AdminPanelController } from './use-admin-panel-controller'
import { AgentRiskProfileCard } from './AgentRiskProfileCard'
import {
  ACTION_LABELS,
  ACTION_OPTIONS,
  COMMUNITY_INCUBATION_VISIBILITY_LABELS,
  COMMUNITY_LIFECYCLE_LABELS,
  COMMUNITY_PROPOSAL_ACTION_LABELS,
  COMMUNITY_PROPOSAL_STATUS_LABELS,
  TARGET_OPTIONS,
  STATE_LABELS,
  VISIBILITY_LABELS,
} from './constants'
import { DisclosureCapCard } from './DisclosureCapCard'
import { IdentityReviewCard } from './IdentityReviewCard'
import { ReviewQueueCard } from './ReviewQueueCard'

type GovernanceTabProps = Pick<
  AdminPanelController,
  'auth' | 'governance' | 'riskProfile' | 'disclosureCaps' | 'review' | 'communityGovernance'
>

function resolveCommunityLifecycleState(community: Pick<Community, 'rules_json'>): string {
  const raw = community.rules_json?.community_lifecycle_state
  return typeof raw === 'string' ? raw : 'launch_support'
}

function findCommunityName(communities: Community[], communityId: string | null | undefined): string | null {
  if (!communityId) return null
  return communities.find((community) => community.id === communityId)?.name ?? communityId
}

function ProposalCard({
  item,
  communities,
  onAction,
  onRefresh,
  isPending,
}: {
  item: CommunityProposalListItem
  communities: Community[]
  onAction: (proposalId: string, action: 'incubate' | 'activate' | 'merge' | 'reject' | 'seasonal_slot' | 'archive') => void
  onRefresh: (proposalId: string) => void
  isPending: boolean
}) {
  const recommendation = item.recommendation
  return (
    <div className="rounded-md border bg-card px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{item.proposal.name}</p>
            <Badge variant="outline">
              {COMMUNITY_PROPOSAL_STATUS_LABELS[item.proposal.status]}
            </Badge>
            <Badge variant="secondary">{item.proposal.proposed_community_family}</Badge>
            <Badge variant="outline">{item.proposal.publication_review_profile_id}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            `{item.proposal.slug_candidate}` · {item.proposal.description}
          </p>
          <p className="text-[11px] text-muted-foreground">
            场景: {item.proposal.scene_types.join(', ') || '未指定'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            参与: {item.proposal.public_participation_mode} · {item.proposal.audience_signal_ingestion} · {item.proposal.agent_human_response_mode}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => onRefresh(item.proposal.id)}
        >
          刷新建议
        </Button>
      </div>

      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <p>
          duplicate_of: {findCommunityName(communities, recommendation?.duplicate_of_community_id) ?? '无'}
        </p>
        <p>
          lane: {findCommunityName(communities, recommendation?.recommended_as_lane_community_id) ?? '无'}
        </p>
        <p>
          visibility: {recommendation
            ? COMMUNITY_INCUBATION_VISIBILITY_LABELS[recommendation.incubation_visibility_mode]
            : '无'}
          {' · '}
          overlap: {recommendation?.overlap_score ?? 0}
        </p>
        {recommendation?.rationale?.[0] && (
          <p>{recommendation.rationale[0]}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={isPending} onClick={() => onAction(item.proposal.id, 'incubate')}>
          {COMMUNITY_PROPOSAL_ACTION_LABELS.incubate}
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => onAction(item.proposal.id, 'seasonal_slot')}>
          {COMMUNITY_PROPOSAL_ACTION_LABELS.seasonal_slot}
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => onAction(item.proposal.id, 'activate')}>
          {COMMUNITY_PROPOSAL_ACTION_LABELS.activate}
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => onAction(item.proposal.id, 'merge')}>
          {COMMUNITY_PROPOSAL_ACTION_LABELS.merge}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => onAction(item.proposal.id, 'reject')}>
          {COMMUNITY_PROPOSAL_ACTION_LABELS.reject}
        </Button>
      </div>
    </div>
  )
}

export function GovernanceTab({
  auth,
  governance,
  riskProfile,
  disclosureCaps,
  review,
  communityGovernance,
}: GovernanceTabProps) {
  const lifecycleCommunities = communityGovernance.communities.map((community) => ({
    ...community,
    lifecycleState: resolveCommunityLifecycleState(community),
  }))

  return (
    <div className={"mt-4 space-y-4"}>
      <Card>
        <CardHeader className={"pb-2"}>
          <CardTitle className={"text-sm"}>执行治理操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor="governance-action"
                className={"mb-1 block text-[10px] font-medium text-muted-foreground"}
              >
                操作类型
              </label>
              <select
                id="governance-action"
                name="governance-action"
                value={governance.action}
                onChange={(event) =>
                  governance.setAction(event.target.value as typeof governance.action)
                }
                className={"h-8 w-full rounded-md border bg-background px-2 text-xs"}
              >
                {ACTION_OPTIONS.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="governance-target-type"
                className={"mb-1 block text-[10px] font-medium text-muted-foreground"}
              >
                目标类型
              </label>
              <select
                id="governance-target-type"
                name="governance-target-type"
                value={governance.targetType}
                onChange={(event) => governance.setTargetType(event.target.value)}
                className={"h-8 w-full rounded-md border bg-background px-2 text-xs"}
              >
                {TARGET_OPTIONS.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label htmlFor="governance-target-id" className="sr-only">
            目标 ID
          </label>
          <Input
            id="governance-target-id"
            name="governance-target-id"
            placeholder="目标 ID（如 post_123…）"
            value={governance.targetId}
            onChange={(event) => governance.setTargetId(event.target.value)}
            className={"h-8 text-xs"}
          />
          <label htmlFor="governance-reason" className="sr-only">
            治理原因
          </label>
          <Input
            id="governance-reason"
            name="governance-reason"
            placeholder="原因（选填）"
            value={governance.reason}
            onChange={(event) => governance.setReason(event.target.value)}
            className={"h-8 text-xs"}
          />
          <Button
            size="sm"
            onClick={() => {
              void governance.handleSubmit()
            }}
            disabled={governance.mutation.isPending || !governance.targetId.trim()}
          >
            {governance.mutation.isPending ? '执行中…' : '执行操作'}
          </Button>
          {governance.mutation.isError && (
            <p className={"text-xs text-destructive"}>
              {governance.mutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {governance.history.length > 0 && (
        <section>
          <h2 className={"mb-2 text-sm font-semibold"}>操作记录</h2>
          <div className="space-y-1">
            {governance.history.map((result, index) => (
              <div key={index} className={"flex items-center justify-between rounded-md border bg-card px-3 py-2"}>
                <div>
                  <p className={"text-xs font-medium"}>
                    {ACTION_LABELS[result.action] ?? result.action} → {result.target_id}
                  </p>
                  <p className={"text-[10px] text-muted-foreground"}>
                    {result.new_visibility &&
                      `可见性：${VISIBILITY_LABELS[result.new_visibility] ?? result.new_visibility}`}
                    {result.new_state &&
                      ` · 状态：${STATE_LABELS[result.new_state] ?? result.new_state}`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    result.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }
                >
                  {result.success ? '成功' : '失败'}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Proposal Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label htmlFor="proposal-target-community-id" className="sr-only">
              归并目标社区 ID
            </label>
            <Input
              id="proposal-target-community-id"
              name="proposal-target-community-id"
              placeholder="归并目标社区 ID（可选）"
              value={communityGovernance.targetCommunityId}
              onChange={(event) => communityGovernance.setTargetCommunityId(event.target.value)}
              className="h-8 text-xs"
            />
            <div>
              <label
                htmlFor="proposal-visibility-mode"
                className="mb-1 block text-[10px] font-medium text-muted-foreground"
              >
                孵化可见性
              </label>
              <select
                id="proposal-visibility-mode"
                name="proposal-visibility-mode"
                value={communityGovernance.visibilityMode}
                onChange={(event) =>
                  communityGovernance.setVisibilityMode(
                    event.target.value as typeof communityGovernance.visibilityMode,
                  )
                }
                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
              >
                {Object.entries(COMMUNITY_INCUBATION_VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <label htmlFor="proposal-governance-reason" className="sr-only">
              社区治理备注
            </label>
            <Input
              id="proposal-governance-reason"
              name="proposal-governance-reason"
              placeholder="社区治理备注（选填）"
              value={communityGovernance.reason}
              onChange={(event) => communityGovernance.setReason(event.target.value)}
              className="h-8 text-xs"
            />
            <div className="space-y-2">
              {communityGovernance.proposals.length === 0 && (
                <p className="text-xs text-muted-foreground">当前没有社区提案。</p>
              )}
              {communityGovernance.proposals.map((item) => (
                <ProposalCard
                  key={item.proposal.id}
                  item={item}
                  communities={communityGovernance.communities}
                  isPending={
                    communityGovernance.actionMutation.isPending
                    || communityGovernance.refreshMutation.isPending
                  }
                  onRefresh={(proposalId) => {
                    void communityGovernance.handleRefreshRecommendation(proposalId)
                  }}
                  onAction={(proposalId, action) => {
                    void communityGovernance.handleAction(proposalId, action)
                  }}
                />
              ))}
            </div>
            {(communityGovernance.actionMutation.isError || communityGovernance.refreshMutation.isError) && (
              <p className="text-xs text-destructive">
                {communityGovernance.actionMutation.error?.message
                  ?? communityGovernance.refreshMutation.error?.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lifecycle Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lifecycleCommunities.map((community) => (
              <div
                key={community.id}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium">{community.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    `{community.slug}` · {community.description ?? '无描述'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {COMMUNITY_LIFECYCLE_LABELS[
                      community.lifecycleState as keyof typeof COMMUNITY_LIFECYCLE_LABELS
                    ] ?? community.lifecycleState}
                  </Badge>
                  <Badge variant="outline">
                    {VISIBILITY_LABELS[community.visibility_default] ?? community.visibility_default}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Merge Recommendation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {communityGovernance.proposals.map((item) => (
              <div key={`recommendation-${item.proposal.id}`} className="rounded-md border px-3 py-2">
                <p className="text-xs font-medium">{item.proposal.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  duplicate_of: {findCommunityName(communityGovernance.communities, item.recommendation?.duplicate_of_community_id) ?? '无'}
                  {' · '}
                  lane: {findCommunityName(communityGovernance.communities, item.recommendation?.recommended_as_lane_community_id) ?? '无'}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {(item.recommendation?.rationale ?? []).join(' / ') || '等待 recommendation'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Incubation Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {communityGovernance.proposals
              .filter((item) =>
                item.proposal.status === 'INCUBATING'
                || item.proposal.status === 'SEASONAL'
                || item.proposal.status === 'ACTIVATED')
              .map((item) => (
                <div key={`incubation-${item.proposal.id}`} className="rounded-md border px-3 py-2">
                  <p className="text-xs font-medium">{item.proposal.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    状态: {COMMUNITY_PROPOSAL_STATUS_LABELS[item.proposal.status]}
                    {' · '}
                    resulting community: {findCommunityName(communityGovernance.communities, item.proposal.resulting_community_id) ?? '未生成'}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    可见性: {item.proposal.incubation_visibility_mode
                      ? COMMUNITY_INCUBATION_VISIBILITY_LABELS[item.proposal.incubation_visibility_mode]
                      : '公开'}
                  </p>
                </div>
              ))}
            {communityGovernance.proposals.every((item) =>
              item.proposal.status !== 'INCUBATING'
              && item.proposal.status !== 'SEASONAL'
              && item.proposal.status !== 'ACTIVATED') && (
              <p className="text-xs text-muted-foreground">当前没有进入孵化或季节档的社区提案。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AgentRiskProfileCard governance={governance} riskProfile={riskProfile} />
        <DisclosureCapCard disclosureCaps={disclosureCaps} />
      </div>

      <ReviewQueueCard auth={auth} review={review} />
      <IdentityReviewCard review={review} />
    </div>
  )
}
