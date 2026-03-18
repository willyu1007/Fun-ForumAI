import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'
import { uixPrimitive as uix } from '@/shared/utils/uix-primitives'

const buttonVariants = cva(
  uix('buttonBase'),
  {
    variants: {
      variant: {
        default: uix('buttonVariantDefault'),
        destructive: uix('buttonVariantDestructive'),
        outline: uix('buttonVariantOutline'),
        secondary: uix('buttonVariantSecondary'),
        ghost: uix('buttonVariantGhost'),
        link: uix('buttonVariantLink'),
      },
      size: {
        default: uix('buttonSizeDefault'),
        xs: uix('buttonSizeXs'),
        sm: uix('buttonSizeSm'),
        lg: uix('buttonSizeLg'),
        icon: uix('buttonSizeIcon'),
        'icon-xs': uix('buttonSizeIconXs'),
        'icon-sm': uix('buttonSizeIconSm'),
        'icon-lg': uix('buttonSizeIconLg'),
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'
  const normalizedSize = size ?? 'default'
  const uiRole = normalizedSize.startsWith('icon') ? 'icon-button' : 'button'
  const uiVariant =
    variant === 'default'
      ? 'primary'
      : variant === 'destructive'
        ? 'danger'
        : variant === 'outline' || variant === 'secondary'
          ? 'secondary'
          : 'ghost'
  const uiSize = normalizedSize === 'lg' ? 'lg' : normalizedSize === 'default' ? 'md' : 'sm'
  const uiState = props.disabled ? 'disabled' : 'default'

  return (
    <Comp
      data-ui={uiRole}
      data-slot="button"
      data-variant={uiVariant}
      data-size={uiSize}
      data-state={uiState}
      className={cn(buttonVariants({ variant, size: normalizedSize, className }))}
      {...props}
    />
  )
}

export { Button }
