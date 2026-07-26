"use client"

import { useState, useCallback, useContext, createContext, type ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface TabsProps {
  className?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  onValueChange?: (value: string) => void
  orientation?: "horizontal" | "vertical"
  children: ReactNode
}

function Tabs({ className, defaultValue, value, onChange, onValueChange, orientation = "horizontal", children }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || "")
  const currentValue = value !== undefined ? value : internalValue

  const handleChange = useCallback((newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue)
    } else if (onChange) {
      onChange(newValue)
    } else {
      setInternalValue(newValue)
    }
  }, [onChange, onValueChange])

  return (
    <div
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
    >
      <TabsContext.Provider value={{ value: currentValue, onChange: handleChange }}>
        {children}
      </TabsContext.Provider>
    </div>
  )
}

interface TabsListProps {
  className?: string
  variant?: "default" | "line"
  children: ReactNode
}

function TabsList({ className, variant = "default", children }: TabsListProps) {
  return (
    <div
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  className?: string
  value: string
  disabled?: boolean
  children: ReactNode
}

function TabsTrigger({ className, value, disabled, children }: TabsTriggerProps) {
  const { value: currentValue, onChange } = useTabsContext()
  const isActive = currentValue === value

  const handleClick = useCallback(() => {
    if (!disabled) {
      onChange(value)
    }
  }, [disabled, onChange, value])

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      disabled={disabled}
      data-slot="tabs-trigger"
      data-active={isActive ? "" : undefined}
      onClick={handleClick}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-[colors,opacity,box-shadow] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  className?: string
  value: string
  children: ReactNode
}

function TabsContent({ className, value, children }: TabsContentProps) {
  const { value: currentValue } = useTabsContext()
  const isActive = currentValue === value

  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      hidden={!isActive}
      className={cn("flex-1 text-sm outline-none", isActive ? "animate-in fade-in-0 zoom-in-95 duration-75" : "", className)}
    >
      {children}
    </div>
  )
}

const TabsContext = createContext<TabsContextType | null>(null)

interface TabsContextType {
  value: string
  onChange: (value: string) => void
}

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error("useTabsContext must be used within a Tabs component")
  }
  return context
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }