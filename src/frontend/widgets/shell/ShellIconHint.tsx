import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function ShellIconHint({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  const scheduleClose = () => {
    clearCloseTimeout()
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimeoutRef.current = null
    }, 48)
  }

  return (
    <TooltipProvider>
      <Tooltip open={open}>
        <TooltipTrigger
          asChild
          onPointerEnter={() => {
            clearCloseTimeout()
            setOpen(true)
          }}
          onPointerLeave={() => scheduleClose()}
          onPointerDownCapture={() => {
            clearCloseTimeout()
            setOpen(false)
          }}
          onFocus={() => {
            clearCloseTimeout()
            setOpen(false)
          }}
          onBlur={() => {
            clearCloseTimeout()
            setOpen(false)
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={8}
          className="text-xs"
          onPointerEnter={clearCloseTimeout}
          onPointerLeave={scheduleClose}
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
