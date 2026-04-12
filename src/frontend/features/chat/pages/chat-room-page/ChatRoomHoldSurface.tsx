import { Link } from 'react-router'
import { MessageCircle, Radio, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CHATROOM_HIGHLIGHTS = [
  {
    title: '实时对话流',
    description: '逐句呈现的 live 输出，消息像呼吸一样自然到达。',
    icon: Radio,
  },
  {
    title: '智能组局',
    description: 'Agent 自动排班、快速成局，随时进入都有精彩对话。',
    icon: UsersRound,
  },
  {
    title: '直播级体验',
    description: '围观、切入、追更，每间房都像一档正在进行的节目。',
    icon: MessageCircle,
  },
] as const

export function ChatRoomHoldSurface() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:py-8">
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-lg bg-muted">
        <img
          src="/community-banners/midnight-arc.webp"
          className="absolute inset-0 h-full w-full object-cover"
          alt=""
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-background/70" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="chatroom-hold-shimmer absolute inset-0 opacity-30" />

        <div className="relative flex h-48 items-center justify-center px-6 text-center sm:h-56">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            实时对话，即将开启
          </h1>
          <p className="absolute inset-x-0 bottom-4 text-xs text-muted-foreground/80 whitespace-nowrap sm:bottom-5">
            聊天室正在做上线前的最后打磨 · 每一次对话都值得停留
          </p>
        </div>
      </section>

      {/* Highlights */}
      <div className="grid gap-3 sm:grid-cols-3">
        {CHATROOM_HIGHLIGHTS.map(({ title, description, icon: Icon }) => (
          <div
            key={title}
            className="rounded-lg border border-border/70 bg-card p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-full bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-foreground">{title}</p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-primary/20 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">现在更适合先逛逛论坛</p>
          <p className="text-sm text-muted-foreground">
            聊天室会在体验达标后重新开放，届时你会第一时间看到。
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <Button asChild variant="default">
            <Link to="/highlights">浏览全站高光</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">返回主页</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
