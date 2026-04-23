import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Community, CommunityProposalListItem } from '@/api/types'
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
import {
  useGovernanceController,
  useCommunityGovernanceController,
} from './use-governance-controller'

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
    <li data-ui="card" data-variant="outlined" data-padding="sm">
      <div data-ui="stack" data-direction="row" data-align="start" data-justify="between" data-gap="3">
        <div data-ui="stack" data-direction="col" data-gap="1">
          <div data-ui="stack" data-direction="row" data-align="center" data-gap="2">
            <p data-ui="text" data-variant="body" className="font-medium">{item.proposal.name}</p>
            <Badge variant="outline">
              {COMMUNITY_PROPOSAL_STATUS_LABELS[item.proposal.status]}
            </Badge>
            <Badge variant="secondary">{item.proposal.proposed_community_family}</Badge>
            <Badge variant="outline">{item.proposal.publication_review_profile_id}</Badge>
          </div>
          <p data-ui="text" data-variant="caption" data-tone="muted">
            `{item.proposal.slug_candidate}` · {item.proposal.description}
          </p>
          <p data-ui="text" data-variant="caption" data-tone="muted">
            场景: {item.proposal.scene_types.join(', ') || '未指定'}
          </p>
          <p data-ui="text" data-variant="caption" data-tone="muted">
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

      <div data-ui="stack" data-direction="col" data-gap="1" className="mt-2 text-[11px] text-muted-foreground">
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

      <div data-ui="stack" data-direction="row" data-wrap="wrap" data-gap="2" className="mt-3">
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
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" disabled={isPending}>
              {COMMUNITY_PROPOSAL_ACTION_LABELS.reject}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认拒绝提案</DialogTitle>
              <DialogDescription>
                您确定要拒绝提案 "{item.proposal.name}" 吗？此操作不可撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">取消</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" onClick={() => onAction(item.proposal.id, 'reject')}>
                  确认拒绝
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </li>
  )
}

export function GovernanceTab() {
  const governance = useGovernanceController()
  const communityGovernance = useCommunityGovernanceController()

  const lifecycleCommunities = communityGovernance.communities.map((community) => ({
    ...community,
    lifecycleState: resolveCommunityLifecycleState(community),
  }))

  return (
    <div data-ui="stack" data-direction="col" data-gap="5" className="mt-4">
        <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
          <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">执行治理操作</h2>
          <div data-ui="stack" data-direction="col" data-gap="4">
            <div data-ui="grid" data-gap="4" className="sm:grid-cols-2">
              <div>
                <label
                  htmlFor="governance-action"
                  className="mb-1 block text-sm font-medium text-muted-foreground"
                >
                  操作类型
                </label>
                <Select
                  value={governance.action}
                  onValueChange={(value) => governance.setAction(value as typeof governance.action)}
                >
                  <SelectTrigger id="governance-action" aria-label="操作类型">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor="governance-target-type"
                  className="mb-1 block text-sm font-medium text-muted-foreground"
                >
                  目标类型
                </label>
                <Select
                  value={governance.targetType}
                  onValueChange={(value) => governance.setTargetType(value)}
                >
                  <SelectTrigger id="governance-target-type" aria-label="目标类型">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_OPTIONS.map((target) => (
                      <SelectItem key={target.value} value={target.value}>
                        {target.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div data-ui="grid" data-gap="4" className="sm:grid-cols-2">
              <div>
                <label htmlFor="governance-target-id" className="mb-1 block text-sm font-medium text-muted-foreground">
                  目标 ID
                </label>
                <Input
                  id="governance-target-id"
                  name="governance-target-id"
                  placeholder="目标 ID（如 post_123…）"
                  value={governance.targetId}
                  onChange={(event) => governance.setTargetId(event.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label htmlFor="governance-reason" className="mb-1 block text-sm font-medium text-muted-foreground">
                  治理原因
                </label>
                <Input
                  id="governance-reason"
                  name="governance-reason"
                  placeholder="原因（选填）"
                  value={governance.reason}
                  onChange={(event) => governance.setReason(event.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  void governance.handleSubmit()
                }}
                disabled={governance.mutation.isPending || !governance.targetId.trim()}
              >
                {governance.mutation.isPending ? '执行中…' : '执行操作'}
              </Button>
            </div>
            {governance.mutation.isError && (
              <p data-ui="text" data-variant="caption" data-tone="danger">
                {governance.mutation.error.message}
              </p>
            )}
          </div>
        </section>

      {governance.history.length > 0 && (
        <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
          <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">操作记录</h2>
          <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
            {governance.history.map((result, index) => (
              <li key={index} data-ui="card" data-variant="outlined" data-padding="sm" className="flex items-center justify-between">
                <div>
                  <p data-ui="text" data-variant="caption" className="font-medium">
                    {ACTION_LABELS[result.action] ?? result.action} → {result.target_id}
                  </p>
                  <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                    {result.new_visibility &&
                      `可见性：${VISIBILITY_LABELS[result.new_visibility] ?? result.new_visibility}`}
                    {result.new_state &&
                      ` · 状态：${STATE_LABELS[result.new_state] ?? result.new_state}`}
                  </p>
                </div>
                <Badge data-ui="badge" data-variant="subtle" data-tone={result.success ? "success" : "danger"}>
                  {result.success ? '成功' : '失败'}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div data-ui="grid" data-gap="5" className="xl:grid-cols-2">
        <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
          <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">社区提案队列</h2>
          <div data-ui="stack" data-direction="col" data-gap="4">
            <label htmlFor="proposal-target-community-id" className="sr-only">
              归并目标社区 ID
            </label>
            <Input
              id="proposal-target-community-id"
              name="proposal-target-community-id"
              placeholder="归并目标社区 ID（可选）"
              value={communityGovernance.targetCommunityId}
              onChange={(event) => communityGovernance.setTargetCommunityId(event.target.value)}
              className="h-9 text-sm"
            />
            <div>
              <label
                htmlFor="proposal-visibility-mode"
                className="mb-1 block text-sm font-medium text-muted-foreground"
              >
                孵化可见性
              </label>
              <Select
                value={communityGovernance.visibilityMode}
                onValueChange={(value) =>
                  communityGovernance.setVisibilityMode(value as typeof communityGovernance.visibilityMode)
                }
              >
                <SelectTrigger id="proposal-visibility-mode" aria-label="孵化可见性">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMMUNITY_INCUBATION_VISIBILITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              className="h-9 text-sm"
            />
            <ul data-ui="list" data-variant="admin-rows" className="space-y-4">
              {communityGovernance.proposals.length === 0 && (
                <p data-ui="text" data-variant="caption" data-tone="muted">当前没有社区提案。</p>
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
            </ul>
            {(communityGovernance.actionMutation.isError || communityGovernance.refreshMutation.isError) && (
              <p data-ui="text" data-variant="caption" data-tone="danger">
                {communityGovernance.actionMutation.error?.message
                  ?? communityGovernance.refreshMutation.error?.message}
              </p>
            )}
          </div>
        </section>

        <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
          <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">社区生命周期</h2>
          <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
            {lifecycleCommunities.map((community) => (
              <li
                key={community.id}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
              >
                <div>
                  <p data-ui="text" data-variant="caption" className="font-medium">{community.name}</p>
                  <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                    `{community.slug}` · {community.description ?? '无描述'}
                  </p>
                </div>
                <div data-ui="stack" data-direction="row" data-align="center" data-gap="2">
                  <Badge variant="outline">
                    {COMMUNITY_LIFECYCLE_LABELS[
                      community.lifecycleState as keyof typeof COMMUNITY_LIFECYCLE_LABELS
                    ] ?? community.lifecycleState}
                  </Badge>
                  <Badge variant="outline">
                    {VISIBILITY_LABELS[community.visibility_default] ?? community.visibility_default}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div data-ui="grid" data-gap="5" className="xl:grid-cols-2">
        <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
          <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">社区合并建议</h2>
          <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
            {communityGovernance.proposals.map((item) => (
              <li key={`recommendation-${item.proposal.id}`} className="rounded-md border px-3 py-2">
                <p data-ui="text" data-variant="caption" className="font-medium">{item.proposal.name}</p>
                <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                  duplicate_of: {findCommunityName(communityGovernance.communities, item.recommendation?.duplicate_of_community_id) ?? '无'}
                  {' · '}
                  lane: {findCommunityName(communityGovernance.communities, item.recommendation?.recommended_as_lane_community_id) ?? '无'}
                </p>
                <p data-ui="text" data-variant="caption" data-tone="muted" className="mt-1 text-[10px]">
                  {(item.recommendation?.rationale ?? []).join(' / ') || '等待 recommendation'}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section data-ui="section" data-variant="default" data-padding="md" className="border-b">
          <h2 data-ui="text" data-variant="h3" className="mb-4 font-semibold">社区孵化状态</h2>
          <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
            {communityGovernance.proposals
              .filter((item) =>
                item.proposal.status === 'INCUBATING'
                || item.proposal.status === 'SEASONAL'
                || item.proposal.status === 'ACTIVATED')
              .map((item) => (
                <li key={`incubation-${item.proposal.id}`} className="rounded-md border px-3 py-2">
                  <p data-ui="text" data-variant="caption" className="font-medium">{item.proposal.name}</p>
                  <p data-ui="text" data-variant="caption" data-tone="muted" className="text-[10px]">
                    状态: {COMMUNITY_PROPOSAL_STATUS_LABELS[item.proposal.status]}
                    {' · '}
                    resulting community: {findCommunityName(communityGovernance.communities, item.proposal.resulting_community_id) ?? '未生成'}
                  </p>
                  <p data-ui="text" data-variant="caption" data-tone="muted" className="mt-1 text-[10px]">
                    可见性: {item.proposal.incubation_visibility_mode
                      ? COMMUNITY_INCUBATION_VISIBILITY_LABELS[item.proposal.incubation_visibility_mode]
                      : '公开'}
                  </p>
                </li>
              ))}
          </ul>
          {communityGovernance.proposals.every((item) =>
            item.proposal.status !== 'INCUBATING'
            && item.proposal.status !== 'SEASONAL'
            && item.proposal.status !== 'ACTIVATED') && (
            <p className="mt-2 text-xs text-muted-foreground">当前没有进入孵化或季节档的社区提案。</p>
          )}
        </section>
      </div>

      <div data-ui="grid" data-gap="5" className="xl:grid-cols-2">
        <AgentRiskProfileCard />
        <DisclosureCapCard />
      </div>

      <ReviewQueueCard />
      <IdentityReviewCard />
    </div>
  )
}
