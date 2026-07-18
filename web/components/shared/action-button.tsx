'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActionButtonProps {
  onClick: () => void | Promise<void>
  loading?: boolean
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm'
  children: ReactNode
  className?: string
  title?: string
}

export function ActionButton({ onClick, loading, disabled, variant = 'default', size = 'sm', children, className, title }: ActionButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn('inline-flex items-center gap-1', className)}
      title={title}
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </Button>
  )
}
