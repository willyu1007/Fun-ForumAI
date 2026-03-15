import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import type { RoomCastRole } from '@/api/types'
import { HOT_TOPIC_MODE_LABELS } from '@/shared/utils/hot-topic-policy'
import { uix } from '@/shared/utils/uix'
import { CUE_LABEL, ROLE_LABEL, SCENE_LABEL } from './constants'
import type { DirectorPanelController } from './use-director-panel-controller'

type ControlTabProps = Pick<
  DirectorPanelController,
  'compact' | 'controlState' | 'programForm' | 'cueForm' | 'memberControl'
>

export function DirectorControlTab({
  compact,
  controlState,
  programForm,
  cueForm,
  memberControl,
}: ControlTabProps) {
  return (
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
                disabled={programForm.patchProgram.isPending}
                onClick={() =>
                  programForm.patchProgram.mutate({ enabled: !controlState.program.enabled })
                }
              >
                {controlState.program.enabled ? '暂停节目' : '开启节目'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={programForm.patchProgram.isPending}
                onClick={() =>
                  programForm.patchProgram.mutate({
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
                value={programForm.sceneType}
                onValueChange={(value) => programForm.setSceneType(value as never)}
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
              <Input
                value={programForm.shortHook}
                onChange={(event) => programForm.setShortHook(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className={uix('uix-25be576b96')}>热点模式</p>
              <Select
                value={programForm.hotTopicMode}
                onValueChange={(value) => programForm.setHotTopicMode(value as never)}
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
                variant={programForm.noRecommend ? 'secondary' : 'outline'}
                className="w-full"
                onClick={() => programForm.setNoRecommend((current) => !current)}
              >
                {programForm.noRecommend ? '当前为 no_recommend' : '允许进入推荐'}
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            disabled={programForm.patchProgram.isPending}
            onClick={() =>
              programForm.patchProgram.mutate({
                scene_type: programForm.sceneType,
                director_policy: {
                  ...(controlState.program.director_policy ?? {}),
                  hot_topic_mode: programForm.hotTopicMode,
                },
                discoverability: {
                  ...(controlState.program.discoverability ?? {}),
                  short_hook: programForm.shortHook || null,
                  tags: programForm.discoverabilityTags,
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
            <Select value={cueForm.cueType} onValueChange={(value) => cueForm.setCueType(value as never)}>
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
              value={cueForm.targetRole}
              onValueChange={(value) => cueForm.setTargetRole(value as never)}
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
            value={cueForm.cueGoal}
            onChange={(event) => cueForm.setCueGoal(event.target.value)}
            placeholder="例如：把“夜宵税”旧梗稳稳回收，并让主持人把悬念落到行为动机。"
          />
          <Button
            size="sm"
            disabled={cueForm.createCue.isPending || !cueForm.cueGoal.trim()}
            onClick={() =>
              cueForm.createCue.mutate(
                {
                  cue_type: cueForm.cueType,
                  director_goal: cueForm.cueGoal.trim(),
                  target_roles: cueForm.targetRole === 'AUTO' ? undefined : [cueForm.targetRole],
                },
                {
                  onSuccess: () => cueForm.setCueGoal(''),
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
            <p className={uix('uix-25be576b96')}>角色提示、聚光权重、游走资格与压制窗口。</p>
          </div>
          <div className="space-y-3">
            {memberControl.members.map((member) => {
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
                          memberControl.patchMemberControl.mutate({
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
                            memberControl.patchMemberControl.mutate({
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
                      disabled={memberControl.patchMemberControl.isPending}
                      onClick={() =>
                        memberControl.patchMemberControl.mutate({
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
                      disabled={memberControl.patchMemberControl.isPending}
                      onClick={() =>
                        memberControl.patchMemberControl.mutate({
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
  )
}
