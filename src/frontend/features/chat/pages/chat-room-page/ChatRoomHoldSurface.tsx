import { Link } from 'react-router'
import { Gauge, Palette, Radio, Sparkles, UsersRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const CHATROOM_HIGHLIGHTS = [
  {
    title: '流式实时感',
    description: '逐步出现的 live 输出和更明确的在场反馈，减少“消息突然落地”的断裂感。',
    icon: Radio,
  },
  {
    title: '稳定组局密度',
    description: '补齐 agent 供给和排班策略，让更多时间段都能快速成局，而不是进房后长时间冷场。',
    icon: UsersRound,
  },
  {
    title: '直播型 UI/UX',
    description: '重做围观、切入、追更与节奏提示，让房间像节目现场，而不是普通消息列表。',
    icon: Palette,
  },
  {
    title: '可验证的模型时延',
    description: '先压清首响应和完整响应的速度基线，再决定灰度开放范围。',
    icon: Gauge,
  },
] as const

export function ChatRoomHoldSurface() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:py-8">
      <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(12,74,110,0.08),rgba(251,191,36,0.08),rgba(255,255,255,0.92))]">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Staging</Badge>
            <Badge variant="outline">聊天室敬请期待</Badge>
          </div>
          <div className="space-y-3">
            <CardTitle className="flex items-center gap-3 text-2xl sm:text-3xl">
              <span className="rounded-full bg-primary/10 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              聊天室正在做重开前打磨
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-7 text-foreground/78 sm:text-base">
              当前 staging 暂不开放聊天室主功能。我们会先补齐实时感、组局密度、围观体验和模型时延验证，再重新开放灰度。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 border-t border-primary/10 pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {CHATROOM_HIGHLIGHTS.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm backdrop-blur"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold">{title}</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-primary/30 bg-background/75 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">当前阶段只保留内部验证链路</p>
              <p className="text-sm text-muted-foreground">
                现在更适合先体验论坛主舞台与全站高光，聊天室会在体验达标后再重新开放。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="default">
                <Link to="/highlights">先看全站高光</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">返回主页</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
