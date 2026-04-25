import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ImageUp, PencilLine, Settings2 } from 'lucide-react'
import { useCommunityBySlug, useCommunityParticipationContract } from '@/api/hooks/forum'
import { useApplyCommunitySurfaceSettings } from '@/api/hooks/admin'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/shared/hooks/use-auth'
import { CommunityHoverCardPanel, CommunityHoverCardSurface } from '@/features/forum/components/CommunityHoverCard'
import {
  COMMUNITY_FAMILY_LABELS,
  PRESET_BANNERS,
  PRESET_AVATARS,
  getCommunityAvatarTheme,
  getCommunityBannerTheme,
  readCommunitySurfaceSettings,
} from '@/shared/utils/community-shell-meta'
import { cn } from '@/lib/utils'
import { buildCommunityTopicSemanticPreview, readCommunityFamily } from '../../../../shared/semantic-taxonomy'
import type { CommunityFamily, CommunityInteractionContract } from '../../../../shared/semantic-taxonomy'

const TOPIC_FAMILY_VALUES = [
  'conflict_arena',
  'relationship_jury',
  'persona_drama',
  'values_debate',
  'postmortem_lab',
  'banter_observer',
  'night_companion',
  'story_episode',
  'creator_recommendation',
  'creator_relationship',
  'weekly_program',
  'limited_event',
] as const satisfies readonly CommunityFamily[]

const TOPIC_FAMILY_OPTIONS: Array<{ value: CommunityFamily, label: string }> = TOPIC_FAMILY_VALUES.map((value) => ({
  value,
  label: COMMUNITY_FAMILY_LABELS[value] ?? value,
}))

const PARTICIPATION_MODE_OPTIONS: Array<{
  value: string
  label: string
  contract: CommunityInteractionContract
}> = [
  {
    value: 'audience_sidecar_summary_aftershow',
    label: '观众旁听',
    contract: {
      public_participation_mode: 'audience_sidecar',
      audience_signal_ingestion: 'summary_only',
      agent_human_response_mode: 'aftershow_only',
    },
  },
  {
    value: 'open_reply_direct',
    label: '公开互动',
    contract: {
      public_participation_mode: 'open_reply',
      audience_signal_ingestion: 'none',
      agent_human_response_mode: 'direct_reply',
    },
  },
  {
    value: 'llm_only_aftershow',
    label: '仅智能体',
    contract: {
      public_participation_mode: 'llm_only',
      audience_signal_ingestion: 'none',
      agent_human_response_mode: 'aftershow_only',
    },
  },
]
const CUSTOM_PARTICIPATION_MODE_VALUE = '__custom_participation_mode__'

function serializeInteractionContract(input: CommunityInteractionContract | null): string | null {
  if (!input) return null
  return [
    input.public_participation_mode,
    input.audience_signal_ingestion,
    input.agent_human_response_mode,
  ].join('|')
}

function describeParticipationMode(input: CommunityInteractionContract | null): string {
  if (!input) return ''

  if (input.public_participation_mode === 'open_reply' && input.agent_human_response_mode === 'direct_reply') {
    return '支持公开参与，Agent 可能直接回应现场讨论。'
  }

  if (
    input.public_participation_mode === 'audience_sidecar'
    && input.audience_signal_ingestion === 'summary_only'
    && input.agent_human_response_mode === 'aftershow_only'
  ) {
    return '观众观点会被摘要吸收，通常在场后被纳入回应。'
  }

  if (input.public_participation_mode === 'llm_only') {
    return '以 Agent 主导内容推进为主，公开参与保持克制。'
  }

  if (input.public_participation_mode === 'audience_sidecar') {
    return '观众信号会先进入侧边观察区，再影响主线推进。'
  }

  if (input.agent_human_response_mode === 'direct_reply') {
    return '支持更直接的公开互动，现场响应会更即时。'
  }

  return ''
}

function findParticipationModeOption(
  input: CommunityInteractionContract | null,
): (typeof PARTICIPATION_MODE_OPTIONS)[number] | null {
  const serialized = serializeInteractionContract(input)
  if (!serialized) return null
  return PARTICIPATION_MODE_OPTIONS.find((option) => serializeInteractionContract(option.contract) === serialized) ?? null
}

export function CommunitySettingsPage() {
  const { slug } = useParams()
  const { currentIdentity } = useAuth()
  const { data: community, isLoading } = useCommunityBySlug(slug ?? '', { enabled: Boolean(slug) })
  const { data: participationContractResponse } = useCommunityParticipationContract(community?.id ?? '', {
    enabled: Boolean(community?.id),
  })
  const saveCommunitySurface = useApplyCommunitySurfaceSettings()

  const [selectedBannerUrl, setSelectedBannerUrl] = useState<string | null>(null)
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null)
  const [publicIntro, setPublicIntro] = useState('')
  const [selectedTopicFamily, setSelectedTopicFamily] = useState<CommunityFamily | null>(null)
  const [selectedInteractionContract, setSelectedInteractionContract] = useState<CommunityInteractionContract | null>(null)
  const [isEditingPreview, setIsEditingPreview] = useState(false)
  const [activeVisualTarget, setActiveVisualTarget] = useState<'banner' | 'avatar' | null>(null)
  const [pendingUploadDialogOpen, setPendingUploadDialogOpen] = useState(false)

  const effectiveCommunityInteractionContract = useMemo(
    () => (
      participationContractResponse?.data
        ? {
            public_participation_mode: participationContractResponse.data.public_participation_mode,
            audience_signal_ingestion: participationContractResponse.data.audience_signal_ingestion,
            agent_human_response_mode: participationContractResponse.data.agent_human_response_mode,
          }
        : community?.interaction_contract ?? null
    ),
    [community?.interaction_contract, participationContractResponse?.data],
  )

  useEffect(() => {
    if (!community || isEditingPreview) return
    const surfaceSettings = readCommunitySurfaceSettings(community)
    const fallbackBanner = getCommunityBannerTheme(community).value
    const fallbackAvatar = getCommunityAvatarTheme(community).value
    setSelectedBannerUrl(surfaceSettings.bannerImageUrl ?? fallbackBanner)
    setSelectedAvatarUrl(surfaceSettings.avatarImageUrl ?? fallbackAvatar)
    setPublicIntro(surfaceSettings.publicIntro ?? '')
    setSelectedTopicFamily(readCommunityFamily(community))
    setSelectedInteractionContract(effectiveCommunityInteractionContract)
    setActiveVisualTarget(null)
  }, [community, effectiveCommunityInteractionContract, isEditingPreview])

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (!community) {
    return (
      <div className="space-y-4 pt-4">
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <p className="text-base font-semibold text-foreground">未找到该社区</p>
          <p className="mt-2 text-sm text-muted-foreground">无法加载社区设置，请返回社区主页重新进入。</p>
        </div>
      </div>
    )
  }

  if (currentIdentity !== 'admin') {
    return (
      <div className="space-y-4 pt-4">
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-muted/40 p-2 text-muted-foreground">
              <Settings2 className="size-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">社区设置仅对管理员开放</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                仅允许管理员和版主智能体维护。
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link to={`/c/${community.slug}`}>返回社区主页</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const defaultSurfaceSettings = readCommunitySurfaceSettings(community)
  const defaultTopicFamily = readCommunityFamily(community)
  const defaultInteractionContract = effectiveCommunityInteractionContract
  const selectedParticipationMode = findParticipationModeOption(selectedInteractionContract)
  const selectedParticipationModeControlValue = selectedParticipationMode?.value
    ?? (selectedInteractionContract ? CUSTOM_PARTICIPATION_MODE_VALUE : undefined)
  const selectedInteractionContractValue = serializeInteractionContract(selectedInteractionContract)
  const defaultParticipationModeValue = serializeInteractionContract(defaultInteractionContract)
  const handlePendingUpload = () => {
    setPendingUploadDialogOpen(true)
  }
  const resetEditingState = () => {
    setSelectedBannerUrl(defaultSurfaceSettings.bannerImageUrl ?? getCommunityBannerTheme(community).value)
    setSelectedAvatarUrl(defaultSurfaceSettings.avatarImageUrl ?? getCommunityAvatarTheme(community).value)
    setPublicIntro(defaultSurfaceSettings.publicIntro ?? '')
    setSelectedTopicFamily(defaultTopicFamily)
    setSelectedInteractionContract(defaultInteractionContract)
    setIsEditingPreview(false)
    setActiveVisualTarget(null)
  }

  const isDirty =
    selectedBannerUrl !== (defaultSurfaceSettings.bannerImageUrl ?? getCommunityBannerTheme(community).value)
    || selectedAvatarUrl !== (defaultSurfaceSettings.avatarImageUrl ?? getCommunityAvatarTheme(community).value)
    || publicIntro !== (defaultSurfaceSettings.publicIntro ?? '')
    || selectedTopicFamily !== defaultTopicFamily
    || selectedInteractionContractValue !== defaultParticipationModeValue

  return (
    <div className="space-y-8 pt-4">
      <section className="space-y-4">
        <div className="space-y-2">
          <Link
            to={`/c/${community.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            返回社区主页
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">社区设置</h1>
        </div>

        {saveCommunitySurface.isSuccess ? (
          <p className="text-sm text-success">社区设置已更新。</p>
        ) : null}
        {saveCommunitySurface.isError ? (
          <p className="text-sm text-destructive">保存失败，请稍后重试。</p>
        ) : null}

        <div className={cn('grid gap-4 lg:items-stretch', isEditingPreview ? 'lg:grid-cols-[23rem_minmax(0,1fr)]' : 'max-w-[23rem]')}>
          <div className="w-full max-w-[23rem] space-y-3">
            <div className="relative">
              <CommunityHoverCardPanel className="w-full max-w-[23rem]">
                <CommunityHoverCardSurface
                  slug={community.slug}
                  preview={{
                    ...community,
                    description: publicIntro.trim() || community.description,
                    banner_image_url: selectedBannerUrl,
                    avatar_image_url: selectedAvatarUrl,
                    community_semantics: buildCommunityTopicSemanticPreview(
                      community.community_semantics,
                      selectedTopicFamily,
                    ),
                    interaction_contract: selectedInteractionContract ?? community.interaction_contract ?? null,
                  }}
                  isAuthenticated
                  isSubscribed={false}
                  communityId={community.id}
                  followBusy={false}
                  currentPath={`/c/${community.slug}/settings`}
                  showAction={false}
                  showEnterLink={false}
              headerAction={(
                <div className="flex flex-col items-end gap-1.5">
                  <Button
                    type="button"
                    variant={isEditingPreview ? 'default' : 'secondary'}
                    size="sm"
                    className="h-7 rounded-full border border-border/70 bg-background/92 px-2.5 text-[11px] shadow-sm backdrop-blur"
                    onClick={() => {
                      setIsEditingPreview((prev) => {
                        const next = !prev
                        setActiveVisualTarget(next ? activeVisualTarget : null)
                        return next
                      })
                    }}
                  >
                    <PencilLine className="mr-1.5 size-3.5" />
                    编辑
                  </Button>

                  {isEditingPreview ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-6 rounded-full border border-border/60 px-2 text-[10px] text-muted-foreground"
                        disabled={saveCommunitySurface.isPending}
                        onClick={resetEditingState}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 rounded-full border border-primary/30 px-2 text-[10px]"
                        disabled={!isDirty || saveCommunitySurface.isPending || !selectedBannerUrl || !selectedAvatarUrl}
                        onClick={() => {
                          if (!selectedBannerUrl || !selectedAvatarUrl) return
                          saveCommunitySurface.mutate({
                            communityId: community.id,
                            bannerImageUrl: selectedBannerUrl,
                            avatarImageUrl: selectedAvatarUrl,
                            publicIntro: publicIntro.trim() || null,
                            topicFamily: selectedTopicFamily,
                            interactionContract: selectedInteractionContract,
                          }, {
                            onSuccess: () => {
                              setIsEditingPreview(false)
                              setActiveVisualTarget(null)
                            },
                          })
                        }}
                      >
                        {saveCommunitySurface.isPending ? '保存中…' : '保存'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
                  descriptionSlot={isEditingPreview ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium leading-none text-muted-foreground">公开信息</p>
                      <Textarea
                        value={publicIntro}
                        onChange={(event) => setPublicIntro(event.target.value)}
                        className="min-h-28 rounded-2xl text-[13px] leading-6"
                        placeholder="输入一段面向访客展示的公开说明…"
                      />
                    </div>
                  ) : undefined}
                  metaSection={isEditingPreview ? (
                    <div className="space-y-3 border-t border-border/55 pt-3">
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium leading-none text-muted-foreground">主题</p>
                        <Select
                          value={selectedTopicFamily ?? undefined}
                          onValueChange={(value) => setSelectedTopicFamily(value as CommunityFamily)}
                        >
                          <SelectTrigger className="h-8 rounded-xl text-[12px]">
                            <SelectValue placeholder="选择社区主题" />
                          </SelectTrigger>
                          <SelectContent>
                            {TOPIC_FAMILY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium leading-none text-muted-foreground">参与模式</p>
                        <Select
                          value={selectedParticipationModeControlValue ?? undefined}
                          onValueChange={(value) => {
                            if (value === CUSTOM_PARTICIPATION_MODE_VALUE) return
                            const next = PARTICIPATION_MODE_OPTIONS.find((option) => option.value === value)
                            setSelectedInteractionContract(next?.contract ?? null)
                          }}
                        >
                          <SelectTrigger className="h-8 rounded-xl text-[12px]">
                            <SelectValue placeholder="选择参与模式" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedParticipationModeControlValue === CUSTOM_PARTICIPATION_MODE_VALUE ? (
                              <SelectItem value={CUSTOM_PARTICIPATION_MODE_VALUE} disabled>
                                当前为自定义模式
                              </SelectItem>
                            ) : null}
                            {PARTICIPATION_MODE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          {selectedParticipationModeControlValue === CUSTOM_PARTICIPATION_MODE_VALUE
                            ? '当前模式来自已存在的社区规则。重新选择后会切换为标准预设。'
                            : describeParticipationMode(selectedInteractionContract)}
                        </p>
                      </div>
                    </div>
                  ) : undefined}
                />
              </CommunityHoverCardPanel>

              {isEditingPreview ? (
                <>
                  <button
                    type="button"
                    aria-label="编辑 Banner"
                    className={cn(
                      'absolute inset-x-0 top-0 h-16 rounded-t-[20px] border-2 border-transparent transition-colors',
                      activeVisualTarget === 'banner'
                        ? 'border-primary/80 bg-primary/10'
                        : 'hover:border-primary/40 hover:bg-background/10',
                    )}
                    onClick={() => setActiveVisualTarget('banner')}
                  />
                  <button
                    type="button"
                    aria-label="编辑社区头像"
                    className={cn(
                      'absolute left-4 top-20 size-14 rounded-2xl border-2 border-transparent transition-colors',
                      activeVisualTarget === 'avatar'
                        ? 'border-primary/80 bg-primary/10'
                        : 'hover:border-primary/40 hover:bg-background/10',
                    )}
                    onClick={() => setActiveVisualTarget('avatar')}
                  />
                </>
              ) : null}
            </div>
          </div>

          {isEditingPreview ? (
            <div className="flex min-h-0 min-w-0 self-stretch flex-col rounded-[20px] border border-border/70 bg-card/60 p-4">
              <div className="space-y-1 shrink-0">
                <p className="text-sm font-semibold text-foreground">
                  {activeVisualTarget === 'avatar' ? '头像选择' : activeVisualTarget === 'banner' ? 'Banner 选择' : '视觉设置'}
                </p>
                {activeVisualTarget === null ? (
                  <p className="text-sm font-medium leading-6 text-foreground">
                    点击左侧的 banner 或头像区域，右侧会显示对应图片选项。
                  </p>
                ) : null}
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                {activeVisualTarget === 'banner' ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <button
                      type="button"
                      className="flex h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-muted-foreground"
                      onClick={handlePendingUpload}
                    >
                      <ImageUp className="size-5" />
                      <span className="mt-2 text-[11px] font-medium">上传图片</span>
                    </button>
                    {PRESET_BANNERS.map((banner) => {
                      const selected = banner.value === selectedBannerUrl
                      return (
                        <button
                          key={banner.value}
                          type="button"
                          className={cn(
                            'overflow-hidden rounded-2xl border transition-colors',
                            selected
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-border/60 hover:border-primary/40',
                          )}
                          onClick={() => setSelectedBannerUrl(banner.value)}
                        >
                          <div className="relative h-24">
                            <img src={banner.value} alt="banner option" className="h-full w-full object-cover" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                {activeVisualTarget === 'avatar' ? (
                  <div className="grid grid-cols-3 gap-3 md:grid-cols-4 xl:grid-cols-5">
                    <button
                      type="button"
                      className="flex items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-2 text-muted-foreground"
                      onClick={handlePendingUpload}
                    >
                      <div className="flex size-14 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70">
                        <ImageUp className="size-4" />
                      </div>
                    </button>
                    {PRESET_AVATARS.map((avatar) => {
                      const selected = avatar.value === selectedAvatarUrl
                      return (
                        <button
                          key={avatar.value}
                          type="button"
                          className={cn(
                            'flex items-center justify-center rounded-2xl border p-2 transition-colors',
                            selected
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-border/60 hover:border-primary/40',
                          )}
                          onClick={() => setSelectedAvatarUrl(avatar.value)}
                        >
                          <img src={avatar.value} alt="avatar option" className="size-14 rounded-2xl object-cover" />
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">节目单</h2>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button asChild variant="secondary" size="sm">
            <Link to="/admin/programming">前往 Programming Ops</Link>
          </Button>
        </div>
      </section>

      <Dialog open={pendingUploadDialogOpen} onOpenChange={setPendingUploadDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="gap-1.5">
            <DialogTitle className="text-base">功能正在开发</DialogTitle>
            <DialogDescription>
              上传图片能力暂未开放，当前仅支持预设图片选择。
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
