"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(open)
  const isOpen = open !== undefined ? open : internalOpen

  const handleOpenChange = React.useCallback((value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value)
    } else {
      setInternalOpen(value)
    }
  }, [onOpenChange])

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void } | null>(null)

function useDialogContext() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error("Dialog components must be used within a Dialog")
  return ctx
}

interface DialogTriggerProps {
  children?: React.ReactNode
  render?: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
  onClick?: () => void
}

function DialogTrigger({ children, render, onClick }: DialogTriggerProps) {
  const { onOpenChange } = useDialogContext()

  const handleClick = React.useCallback(() => {
    onClick?.()
    onOpenChange(true)
  }, [onClick, onOpenChange])

  if (render) {
    return React.cloneElement(render, { onClick: handleClick })
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  )
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

function DialogClose({ children, render, onClick }: Omit<DialogTriggerProps, 'render'> & { render?: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }> }) {
  const { onOpenChange } = useDialogContext()

  const handleClick = React.useCallback(() => {
    onClick?.()
    onOpenChange(false)
  }, [onClick, onOpenChange])

  if (render) {
    return React.cloneElement(render, { onClick: handleClick })
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  )
}

function DialogOverlay({ className }: { className?: string }) {
  const { onOpenChange } = useDialogContext()

  return (
    <div
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs animate-in fade-in-0",
        className
      )}
      onClick={() => onOpenChange(false)}
    />
  )
}

interface DialogContentProps {
  className?: string
  children?: React.ReactNode
  showCloseButton?: boolean
}

function DialogContent({ className, children, showCloseButton = true }: DialogContentProps) {
  const { open, onOpenChange } = useDialogContext()

  React.useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handleEscape)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm animate-in fade-in-0 zoom-in-95",
          className
        )}
      >
        {children}
        {showCloseButton && (
          <Button
            variant="ghost"
            className="absolute top-2 right-2"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

interface DialogFooterProps {
  className?: string
  showCloseButton?: boolean
  children?: React.ReactNode
}

function DialogFooter({ className, showCloseButton = false, children }: DialogFooterProps) {
  const { onOpenChange } = useDialogContext()

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
    >
      {children}
      {showCloseButton && (
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}