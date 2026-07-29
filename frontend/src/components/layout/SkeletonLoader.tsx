export interface SkeletonProps {
  className?: string
  variant?: 'text' | 'card' | 'circle' | 'table'
  count?: number
}

export default function SkeletonLoader({
  className = '',
  variant = 'text',
  count = 1,
}: SkeletonProps) {
  const items = Array.from({ length: count })

  if (variant === 'circle') {
    return (
      <div className={`w-12 h-12 rounded-full bg-[var(--bg-depth)] animate-pulse ${className}`} />
    )
  }

  if (variant === 'card') {
    return (
      <div className="space-y-4">
        {items.map((_, i) => (
          <div
            key={i}
            className={`p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] animate-pulse space-y-3 ${className}`}
          >
            <div className="h-4 bg-[var(--bg-depth)] rounded w-1/3" />
            <div className="h-8 bg-[var(--bg-depth)] rounded w-1/2" />
            <div className="h-3 bg-[var(--bg-depth)] rounded w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className="space-y-2">
        {items.map((_, i) => (
          <div key={i} className="h-10 bg-[var(--bg-depth)] rounded-xl animate-pulse w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((_, i) => (
        <div key={i} className={`h-3 bg-[var(--bg-depth)] rounded animate-pulse w-full ${className}`} />
      ))}
    </div>
  )
}
