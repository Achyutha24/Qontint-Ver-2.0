import React from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: string
  actions?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  eyebrow?: string
}

/**
 * Consistent application page header.
 *
 * The previous layout rendered a tiny standalone route label (for example
 * "Analyze") above the real page title. That duplicated navigation and made
 * the page feel visually unfinished. The header now has one clear hierarchy:
 * optional eyebrow -> title -> supporting copy.
 */
export default function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  icon: Icon,
  eyebrow,
}: PageHeaderProps) {
  return (
    <header className="page-header space-y-3 pb-5 border-b border-[var(--border-subtle)]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="min-w-0 space-y-2">
          {(eyebrow || badge) && (
            <div className="flex items-center gap-2 flex-wrap">
              {eyebrow && (
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {eyebrow}
                </span>
              )}
              {badge && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-[var(--solar)] text-[var(--aurora)] border border-[var(--aurora)]/20 uppercase tracking-wider">
                  {badge}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-[var(--solar)] border border-[var(--aurora)]/20 flex items-center justify-center text-[var(--aurora)] flex-shrink-0 shadow-sm">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <h1 className="text-3xl md:text-[2.15rem] font-bold font-display text-[var(--text-primary)] tracking-tight leading-tight">
              {title}
            </h1>
          </div>

          {subtitle && (
            <p className="text-sm md:text-[15px] text-[var(--text-secondary)] leading-6 max-w-3xl">
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
    </header>
  )
}
