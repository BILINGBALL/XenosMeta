'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  children?: ReactNode
}

export function FormField({ label, id, value, onChange, type = 'text', placeholder, required, disabled }: FormFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  )
}
