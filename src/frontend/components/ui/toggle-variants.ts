import { cva } from 'class-variance-authority'
import { uixPrimitive as uix } from '@/shared/utils/uix-primitives'

export const toggleVariants = cva(
  uix('toggleBase'),
  {
    variants: {
      variant: {
        default: uix('toggleVariantDefault'),
        outline: uix('toggleVariantOutline'),
      },
      size: {
        default: uix('toggleSizeDefault'),
        sm: uix('toggleSizeSm'),
        lg: uix('toggleSizeLg'),
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
