import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateRoomCue,
  usePatchRoomMemberControl,
  usePatchRoomProgram,
} from '@/api/hooks'
import type {
  RoomCastRole,
  RoomControlState,
  RoomCueType,
  RoomSceneType,
} from '@/api/types'
import {
  hasNoRecommendRoomTag,
  HOT_TOPIC_MODE_LABELS,
  readRoomHotTopicMode,
} from '@/shared/utils/hot-topic-policy'
import { relativeTime } from '@/shared/utils/relative-time'
import { uix } from '@/shared/utils/uix'
import { CUE_LABEL, OWNER_TABS, ROLE_LABEL, SCENE_LABEL } from './constants'

export function DirectorPanel({
  roomId,
  controlState,
  compact = false,
}: {
  roomId: string
  controlState: RoomControlState
  compact?: boolean
}) {
  const patchProgram = usePatchRoomProgram(roomId)
  const createCue = useCreateRoomCue(roomId)
  const patchMemberControl = usePatchRoomMemberControl(roomId)
  const [sceneType, setSceneType] = useState<RoomSceneType>(controlState.program.scene_type)
  const [shortHook, setShortHook] = useState(
    controlState.program.discoverability?.short_hook ?? '',
  )
  const [hotTopicMode, setHotTopicMode] = useState<
    'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
  >(readRoomHotTopicMode(controlState.program as never))
  const [noRecommend, setNoRecommend] = useState(
    hasNoRecommendRoomTag(controlState.program.discoverability?.tags),
  )
  const [cueType, setCueType] = useState<RoomCueType>('ADVANCE')
  const [cueGoal, setCueGoal] = useState('')
  const [targetRole, setTargetRole] = useState<'AUTO' | RoomCastRole>('AUTO')

  useEffect(() => {
    setSceneType(controlState.program.scene_type)
    setShortHook(controlState.program.discoverability?.short_hook ?? '')
    setHotTopicMode(readRoomHotTopicMode(controlState.program as never))
    setNoRecommend(hasNoRecommendRoomTag(controlState.program.discoverability?.tags))
  }, [controlState.program, roomId])

  const discoverabilityTags = noRecommend
    ? Array.from(
        new Set([...(controlState.program.discoverability?.tags ?? []), 'no_recommend']),
      )
    : (controlState.program.discoverability?.tags ?? []).filter(
        (tag) => tag.trim().toLowerCase() !== 'no_recommend',
      )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-ui="section" data-padding="none">
      <Tabs defaultValue={OWNER_TABS[0]} className="flex min-h-0 flex-1 flex-col">
        <div className={uix('uix-50b7a82989')}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={uix('uix-5445c2e8f8')}>房主控制</p>
              <p className={uix('uix-c49a5af3a6')}>
                {controlState.room_status === 'active'
                  ? '房间正在直播'
                  : `状态：${controlState.room_status}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {controlState.alerts.length > 0 && (
                <Badge variant="outline" className={uix('uix-39cf27d91d')}>
                  {controlState.alerts.length} 条提醒
                </Badge>
              )}
              <Badge
                variant={controlState.program.enabled ? 'default' : 'secondary'}
                className={uix('uix-1dc571a360')}
              >
                {controlState.program.enabled ? '节目开启' : '节目暂停'}
              </Badge>
            </div>
          </div>
          <TabsList variant="line" className={uix('uix-8d9994ffa2')}>
            <TabsTrigger value="control">控制</TabsTrigger>
            <TabsTrigger value="signals">信号</TabsTrigger>
            <TabsTrigger value="memory">连续性</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="control" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className={compact ? `${uix('uix-06ae061dcf')} ${uix('uix-e10354c6b8')}` : uix('uix-06ae061dcf')}>
              <section className={uix('uix-dab4332e94')}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={uix('uix-aaa307c4ab')}>节目控制</p>
                    <p className={uix('uix-25be576b96')}>高层策略，不允许直接写台词。</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={controlState.program.enabled ? 'secondary' : 'default'}
                      disabled={patchProgram.isPending}
                      onClick={() =>
                        patchProgram.mutate({ enabled: !controlState.program.enabled })
                      }
                    >
                      {controlState.program.enabled ? '暂停节目' : '开启节目'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={patchProgram.isPending}
                      onClick={() =>
                        patchProgram.mutate({
                          allow_wandering: !controlState.program.allow_wandering,
                          wander_policy: {
                            ...controlState.program.wander_policy,
                            enabled: !controlState.program.wander_policy.enabled,
                          },
                        })
                      }
                    >
                      {controlState.program.allow_wandering ? '关闭游走' : '开启游走'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className={uix('uix-25be576b96')}>节目形态</p>
                    <Select
                      value={sceneType}
                      onValueChange={(value) => setSceneType(value as RoomSceneType)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SCENE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className={uix('uix-25be576b96')}>一句钩子</p>
                    <Input value={shortHook} onChange={(event) => setShortHook(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <p className={uix('uix-25be576b96')}>热点模式</p>
                    <Select
                      value={hotTopicMode}
                      onValueChange={(value) => setHotTopicMode(value as typeof hotTopicMode)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(HOT_TOPIC_MODE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className={uix('uix-25be576b96')}>推荐流</p>
                    <Button
                      type="button"
                      variant={noRecommend ? 'secondary' : 'outline'}
                      className="w-full"
                      onClick={() => setNoRecommend((current) => !current)}
                    >
                      {noRecommend ? '当前为 no_recommend' : '允许进入推荐'}
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={patchProgram.isPending}
                  onClick={() =>
                    patchProgram.mutate({
                      scene_type: sceneType,
                      director_policy: {
                        ...(controlState.program.director_policy ?? {}),
                        hot_topic_mode: hotTopicMode,
                      },
                      discoverability: {
                        ...(controlState.program.discoverability ?? {}),
                        short_hook: shortHook || null,
                        tags: discoverabilityTags,
                      },
                    })
                  }
                >
                  保存节目与热点设定
                </Button>
              </section>

              <section className={uix('uix-dab4332e94')}>
                <div>
                  <p className={uix('uix-aaa307c4ab')}>手动 Cue</p>
                  <p className={uix('uix-25be576b96')}>只接受高层目标和目标角色。</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={cueType} onValueChange={(value) => setCueType(value as RoomCueType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CUE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={targetRole}
                    onValueChange={(value) => setTargetRole(value as 'AUTO' | RoomCastRole)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">自动选择</SelectItem>
                      {Object.entries(ROLE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={cueGoal}
                  onChange={(event) => setCueGoal(event.target.value)}
                  placeholder="例如：把“夜宵税”旧梗稳稳回收，并让主持人把悬念落到行为动机。"
                />
                <Button
                  size="sm"
                  disabled={createCue.isPending || !cueGoal.trim()}
                  onClick={() =>
                    createCue.mutate(
                      {
                        cue_type: cueType,
                        director_goal: cueGoal.trim(),
                        target_roles: targetRole === 'AUTO' ? undefined : [targetRole],
                      },
                      {
                        onSuccess: () => setCueGoal(''),
                      },
                    )
                  }
                >
                  发送 Cue
                </Button>
              </section>

              <section className={uix('uix-dab4332e94')}>
                <div>
                  <p className={uix('uix-aaa307c4ab')}>成员控制</p>
                  <p className={uix('uix-25be576b96')}>
                    角色提示、聚光权重、游走资格与压制窗口。
                  </p>
                </div>
                <div className="space-y-3">
                  {controlState.members.map((member) => {
                    const isSuppressed = Boolean(
                      member.suppressed_until &&
                        new Date(member.suppressed_until).getTime() > Date.now(),
                    )
                    return (
                      <div key={member.member_id} className={uix('uix-227f0f6a9e')}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={uix('uix-aaa307c4ab')}>{member.name}</p>
                            {member.projection?.public_projection_hint && (
                              <p className={uix('uix-dacb762e7b')}>
                                {member.projection.public_projection_hint}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className={uix('uix-1dc571a360')}>
                            {member.join_source}
                          </Badge>
                        </div>
                        <div className={uix('uix-06717fca08')}>
                          <div className="space-y-1">
                            <p className={uix('uix-25be576b96')}>角色提示</p>
                            <Select
                              value={member.role_hint ?? 'AUTO'}
                              onValueChange={(value) =>
                                patchMemberControl.mutate({
                                  agentId: member.member_id,
                                  role_hint: value === 'AUTO' ? null : (value as RoomCastRole),
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AUTO">自动</SelectItem>
                                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <p className={uix('uix-25be576b96')}>聚光权重</p>
                            <Input
                              defaultValue={String(member.spotlight_weight ?? 1)}
                              onBlur={(event) => {
                                const next = Number(event.target.value)
                                if (
                                  Number.isFinite(next) &&
                                  next > 0 &&
                                  next !== member.spotlight_weight
                                ) {
                                  patchMemberControl.mutate({
                                    agentId: member.member_id,
                                    spotlight_weight: next,
                                  })
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className={uix('uix-0f78ac7359')}>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={patchMemberControl.isPending}
                            onClick={() =>
                              patchMemberControl.mutate({
                                agentId: member.member_id,
                                wander_eligible: !(member.wander_eligible ?? true),
                              })
                            }
                          >
                            {member.wander_eligible === false ? '恢复游走' : '禁止游走'}
                          </Button>
                          <Button
                            size="sm"
                            variant={isSuppressed ? 'secondary' : 'outline'}
                            disabled={patchMemberControl.isPending}
                            onClick={() =>
                              patchMemberControl.mutate({
                                agentId: member.member_id,
                                suppressed_until: isSuppressed
                                  ? null
                                  : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                              })
                            }
                          >
                            {isSuppressed ? '解除压制' : '压制 15 分钟'}
                          </Button>
                        </div>
                        {member.projection?.signature_moves_json?.length ? (
                          <p className={uix('uix-f87e38a14b')}>
                            招牌动作：{member.projection.signature_moves_json.join('、')}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="signals" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className={compact ? `${uix('uix-06ae061dcf')} ${uix('uix-e10354c6b8')}` : uix('uix-06ae061dcf')}>
              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>提醒</p>
                <div className={uix('uix-2017a99066')}>
                  {controlState.alerts.length > 0 ? (
                    controlState.alerts.map((alert) => (
                      <Badge key={alert} variant="outline" className={uix('uix-1dc571a360')}>
                        {alert}
                      </Badge>
                    ))
                  ) : (
                    <p className={uix('uix-25be576b96')}>当前没有提醒。</p>
                  )}
                </div>
              </section>

              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>最近高光</p>
                <div className={uix('uix-a7cd7a5d10')}>
                  {controlState.recent_highlights.map((highlight) => (
                    <div key={highlight.id} className={uix('uix-227f0f6a9e')}>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                          {highlight.kind}
                        </Badge>
                        <span className={uix('uix-25be576b96')}>
                          {relativeTime(highlight.created_at)}
                        </span>
                      </div>
                      <p className={uix('uix-90557147b0')}>{highlight.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>节目事件</p>
                <div className={uix('uix-a7cd7a5d10')}>
                  {controlState.recent_program_events.map((event) => (
                    <div key={event.id} className={uix('uix-227f0f6a9e')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={uix('uix-1dc571a360')}>
                            {event.status}
                          </Badge>
                          {event.cue_type && (
                            <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                              {CUE_LABEL[event.cue_type]}
                            </Badge>
                          )}
                        </div>
                        <span className={uix('uix-25be576b96')}>
                          {relativeTime(event.created_at)}
                        </span>
                      </div>
                      {event.director_goal && (
                        <p className={uix('uix-90557147b0')}>{event.director_goal}</p>
                      )}
                      {event.selection_reasons.length > 0 && (
                        <div className={uix('uix-813892bc68')}>
                          {event.selection_reasons.slice(0, 3).map((reason) => (
                            <div key={reason.id} className={uix('uix-be6b041d71')}>
                              {reason.candidate_agent_id} · {reason.selected ? '已选中' : '候选'} ·{' '}
                              {reason.final_score.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="memory" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className={compact ? `${uix('uix-06ae061dcf')} ${uix('uix-e10354c6b8')}` : uix('uix-06ae061dcf')}>
              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>共享记忆</p>
                <div className={uix('uix-a7cd7a5d10')}>
                  {controlState.recent_shared_memory.map((memory) => (
                    <div key={memory.id} className={uix('uix-227f0f6a9e')}>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={uix('uix-1dc571a360')}>
                          {memory.memory_kind}
                        </Badge>
                        <span className={uix('uix-25be576b96')}>
                          {relativeTime(memory.created_at)}
                        </span>
                      </div>
                      <p className={uix('uix-90557147b0')}>{memory.summary_text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={uix('uix-14d24c1f75')}>
                <p className={uix('uix-aaa307c4ab')}>投射摘要</p>
                <div className={uix('uix-a7cd7a5d10')}>
                  {controlState.members.map((member) => (
                    <div key={member.member_id} className={uix('uix-227f0f6a9e')}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={uix('uix-aaa307c4ab')}>{member.name}</p>
                        {member.projection?.role_tendency && (
                          <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                            {ROLE_LABEL[member.projection.role_tendency]}
                          </Badge>
                        )}
                      </div>
                      <p className={uix('uix-f87e38a14b')}>
                        {member.projection?.public_projection_hint ?? '尚未生成公域投射摘要。'}
                      </p>
                      {member.projection?.signature_moves_json?.length ? (
                        <p className={uix('uix-f87e38a14b')}>
                          招牌动作：{member.projection.signature_moves_json.join('、')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
