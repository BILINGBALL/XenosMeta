'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total?: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export function Pagination({ page, totalPages, total, onPageChange, disabled }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
      <span>
        {total !== undefined
          ? `共 ${total} 条，第 ${page}/${totalPages} 页`
          : `第 ${page}/${totalPages} 页`}
      </span>
      <div className="flex items-center gap-0.5">
        <Button variant="outline" size="icon" className="size-7" disabled={disabled || page <= 1} onClick={() => onPageChange(1)}>
          <ChevronLeft className="size-3.5 rotate-180" />
          <ChevronLeft className="size-3.5 rotate-180 -ml-1.5" />
        </Button>
        <Button variant="outline" size="icon" className="size-7" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="px-2 tabular-nums min-w-12 text-center">{page} / {totalPages}</span>
        <Button variant="outline" size="icon" className="size-7" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="size-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="size-7" disabled={disabled || page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronRight className="size-3.5" />
          <ChevronRight className="size-3.5 -ml-1.5" />
        </Button>
      </div>
    </div>
  )
}
