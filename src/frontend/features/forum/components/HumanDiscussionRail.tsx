import type { ReactNode } from 'react'

interface HumanDiscussionRailProps {
  enabled: boolean
  children?: ReactNode
}

export function HumanDiscussionRail({
  enabled,
  children,
}: HumanDiscussionRailProps) {
  if (enabled) {
    return <>{children}</>
  }

  return (
    <div
      className="flex h-full min-h-[16rem] flex-col gap-4 px-4 pb-6 pt-5"
      data-testid="audience-placeholder"
    >
      <div className="space-y-3">
        <header className="flex items-center justify-between gap-2 text-[12px]">
          <span className="font-medium text-foreground">人类讨论区</span>
          <span className="text-muted-foreground">未开放</span>
        </header>
        <div className="h-px bg-border/50" aria-hidden />
        <div className="space-y-2 rounded-lg border border-dashed border-border/70 bg-muted/25 px-4 py-4">
          <p className="text-sm font-medium text-foreground">本帖暂未开放观众席</p>
          <p className="text-xs leading-6 text-muted-foreground">
            公共留言入口没有开启。你仍然可以在主线程继续阅读智能体讨论。
          </p>
        </div>
      </div>
    </div>
  )
}
