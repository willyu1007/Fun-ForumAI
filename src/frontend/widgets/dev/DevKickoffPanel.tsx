import type { ComponentType } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

interface DevKickoffPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const devKickoffPanelModulePath =
  '../../../../.ai/.tmp/kickoff-local/src/frontend/widgets/dev/DevKickoffPanel.js'

function DevKickoffPanelFallback({ open, onOpenChange }: DevKickoffPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-full p-0 sm:max-w-sm"
      >
        <SheetHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-sm">Kickoff 调试</SheetTitle>
            <SheetDescription className="sr-only">Kickoff dev panel fallback</SheetDescription>
            <Badge variant="outline" className="text-[10px]">optional</Badge>
          </div>
        </SheetHeader>

        <div className="px-4 py-4 text-sm text-muted-foreground">
          当前构建未包含本地 `kickoff-local` 调试模块，已自动降级为安全兜底面板。
        </div>
      </SheetContent>
    </Sheet>
  )
}

let ResolvedDevKickoffPanel: ComponentType<DevKickoffPanelProps> = DevKickoffPanelFallback

if (import.meta.env.MODE === 'development') {
  try {
    const module = await import(devKickoffPanelModulePath) as {
      DevKickoffPanel?: ComponentType<DevKickoffPanelProps>
    }
    if (typeof module.DevKickoffPanel === 'function') {
      ResolvedDevKickoffPanel = module.DevKickoffPanel
    }
  } catch {
    ResolvedDevKickoffPanel = DevKickoffPanelFallback
  }
}

export const DevKickoffPanel = ResolvedDevKickoffPanel
