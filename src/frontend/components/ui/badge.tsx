import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'
import { uixPrimitive as uix } from '@/shared/utils/uix-primitives'

const badgeVariants = cva(
  uix('badgeBase'),
  {
    variants: {
      variant: {
        default: uix('badgeVariantDefault'),
        secondary: uix('badgeVariantSecondary'),
        destructive: uix('badgeVariantDestructive'),
        outline: uix('badgeVariantOutline'),
        ghost: uix('badgeVariantGhost'),
        link: uix('badgeVariantLink'),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'
  const tone =
    variant === 'destructive'
      ? 'danger'
      : variant === 'secondary'
        ? 'info'
        : 'neutral'
  const badgeVariant =
    variant === 'outline' || variant === 'ghost' || variant === 'link'
      ? 'subtle'
      : 'solid'

  return (
    <Comp
      data-ui="badge"
      data-slot="badge"
      data-variant={badgeVariant}
      data-tone={tone}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge }
