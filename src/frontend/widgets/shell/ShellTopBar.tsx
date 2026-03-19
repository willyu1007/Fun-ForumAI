import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { TopBar as UiTopBar } from '@fun-forum/ui-web/shell'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import logoSrc from '@/assets/logo.png'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-1.5">
      <img src={logoSrc} alt="AI Talkshow" className="h-7 w-7 rounded-lg" />
    </Link>
  )
}

export interface ShellTopBarProps {
  leftOpen: boolean
  onToggleLeft: () => void
  mobileMenuTrigger?: ReactNode
  primaryActions?: ReactNode
  accountArea?: ReactNode
}

export function ShellTopBar({
  leftOpen,
  onToggleLeft,
  mobileMenuTrigger,
  primaryActions,
  accountArea,
}: ShellTopBarProps) {
  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <UiTopBar
        className="h-12 px-4"
        mobileMenuTrigger={mobileMenuTrigger}
        logo={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="hidden h-8 w-8 p-0 md:flex"
              onClick={onToggleLeft}
              aria-label={leftOpen ? '收起侧栏' : '展开侧栏'}
            >
              <span className="text-lg">☰</span>
            </Button>
            <Logo />
            <Separator orientation="vertical" className="mx-1 hidden h-5 md:block" />
          </>
        }
        actions={
          <>
            {primaryActions}
            {accountArea}
          </>
        }
      />
    </div>
  )
}
