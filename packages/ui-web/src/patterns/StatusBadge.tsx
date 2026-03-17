/**
 * StatusBadge - Status indicator badge
 * 
 * Uses data-ui="badge" with semantic tones.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui'

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export interface StatusBadgeProps {
  children: React.ReactNode
  tone?: StatusTone
  variant?: 'solid' | 'subtle'
  className?: string
}

export function StatusBadge({
  children,
  tone = 'neutral',
  variant = 'subtle',
  className,
}: StatusBadgeProps) {
  return (
    <span
      {...dataUi('badge', { tone, variant })}
      {...dataSlot('badge')}
      className={className}
    >
      {children}
    </span>
  )
}

// Preset status badges
export function SuccessBadge({ children, ...props }: Omit<StatusBadgeProps, 'tone'>) {
  return <StatusBadge tone="success" {...props}>{children}</StatusBadge>
}

export function WarningBadge({ children, ...props }: Omit<StatusBadgeProps, 'tone'>) {
  return <StatusBadge tone="warning" {...props}>{children}</StatusBadge>
}

export function DangerBadge({ children, ...props }: Omit<StatusBadgeProps, 'tone'>) {
  return <StatusBadge tone="danger" {...props}>{children}</StatusBadge>
}

export function InfoBadge({ children, ...props }: Omit<StatusBadgeProps, 'tone'>) {
  return <StatusBadge tone="info" {...props}>{children}</StatusBadge>
}
