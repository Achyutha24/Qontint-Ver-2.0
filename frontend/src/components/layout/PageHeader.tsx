import React from 'react'
import Breadcrumbs from './Breadcrumbs'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: string
  actions?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}

export default function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  icon: Icon,
}: PageHeaderProps) {
  return (
    <div className="space-y-2 pb-4 border-b border-[var(--border-subtle)]">
      <Breadcrumbs />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="w-8 h-8 rounded-xl bg-[var(--aurora)]/10 border border-[var(--aurora)]/20 flex items-center justify-center text-[var(--aurora)] flex-shrink-0">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <h1 className="text-2xl font-bold font-display text-[var(--text-primary)] tracking-tight">
              {title}
            </h1>
            {badge && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[var(--aurora)]/10 text-[var(--aurora)] border border-[var(--aurora)]/20 uppercase tracking-wider">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
