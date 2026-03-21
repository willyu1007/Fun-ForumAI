import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { TopBar as UiTopBar } from '@fun-forum/ui-web/shell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ShellIconHint } from './ShellIconHint'

function Wordmark() {
  return (
    <Link to="/" className="flex min-w-0 items-center">
      <span className="truncate text-[14px] font-semibold uppercase tracking-[0.18em] text-foreground md:text-[15px] md:tracking-[0.28em]">
        AI TALKSHOW
      </span>
    </Link>
  )
}

function SidebarToggleGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[14px] w-[16px] shrink-0 items-center rounded-[4px] border-[1.25px] border-current/50 px-[2.5px]"
    >
      <span className={cn('flex w-full', collapsed ? 'justify-end' : 'justify-start')}>
        <span className="block h-[7px] w-[1.5px] rounded-full bg-current/80 transition-all duration-200" />
      </span>
    </span>
  )
}

export interface ShellTopBarProps {
  leftOpen: boolean
  onToggleLeft: () => void
  mobileMenuTrigger?: ReactNode
  navigation?: ReactNode
  primaryActions?: ReactNode
  accountArea?: ReactNode
}

export function ShellTopBar({
  leftOpen,
  onToggleLeft,
  mobileMenuTrigger,
  navigation,
  primaryActions,
  accountArea,
}: ShellTopBarProps) {
  return (
    <>
      <div aria-hidden="true" className="h-[52px] shrink-0" />
      <div className="fixed inset-x-0 top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <UiTopBar
          className="h-[52px] gap-3 px-3 md:px-4"
          mobileMenuTrigger={mobileMenuTrigger}
          logo={
            <div className="flex items-center gap-3 md:gap-3.5">
              <ShellIconHint label={leftOpen ? '收起侧栏' : '展开侧栏'}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden h-[29px] w-[29px] rounded-xl p-0 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:inline-flex"
                  onClick={onToggleLeft}
                  aria-label={leftOpen ? '收起侧栏' : '展开侧栏'}
                  title={leftOpen ? '收起侧栏' : '展开侧栏'}
                >
                  <SidebarToggleGlyph collapsed={!leftOpen} />
                </Button>
              </ShellIconHint>
              <Wordmark />
            </div>
          }
          navigation={navigation}
          actions={
            <div className="flex items-center gap-3 md:gap-3.5">
              {primaryActions}
              {accountArea}
            </div>
          }
        />
      </div>
    </>
  )
}
