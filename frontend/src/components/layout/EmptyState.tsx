import React from 'react'
import { FolderOpen, Plus, ArrowRight } from 'lucide-react'

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description: string
  primaryActionLabel?: string
  onPrimaryAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}

export default function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <div className="p-12 max-w-lg mx-auto my-8 border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/50 rounded-2xl text-center flex flex-col items-center justify-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-depth)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--aurora)] shadow-inner">
        <Icon className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs">{description}</p>
      </div>

      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3 pt-2">
          {primaryActionLabel && onPrimaryAction && (
            <button
              onClick={onPrimaryAction}
              className="px-4 py-2 rounded-xl bg-[var(--aurora)] text-white text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus size={14} /> {primaryActionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-2 hover:bg-[var(--bg-depth)] transition-colors"
            >
              {secondaryActionLabel} <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
