import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'

interface SectionBottomNavProps {
  prevTabId?: string
  prevTabLabel?: string
  nextTabId?: string
  nextTabLabel?: string
  isBackToTop?: boolean
  onNavigate: (tabId: string) => void
}

export default function SectionBottomNav({
  prevTabId,
  prevTabLabel,
  nextTabId,
  nextTabLabel,
  isBackToTop = false,
  onNavigate,
}: SectionBottomNavProps) {
  return (
    <nav
      aria-label="Guided Section Navigation"
      className="mt-12 pt-8 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4"
    >
      <div className="w-full sm:w-auto">
        {prevTabId && prevTabLabel ? (
          <button
            type="button"
            onClick={() => onNavigate(prevTabId)}
            aria-label={`Go back to ${prevTabLabel}`}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[var(--bg-depth)] border border-[var(--border-subtle)] font-bold text-xs md:text-sm text-[var(--text-secondary)] hover:text-[#F97316] hover:bg-[#FFEDD5]/40 hover:border-[#FED7AA] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
          >
            <ArrowLeft size={16} className="shrink-0" />
            <span>{prevTabLabel}</span>
          </button>
        ) : (
          <div />
        )}
      </div>

      <div className="w-full sm:w-auto">
        {nextTabId && nextTabLabel ? (
          <button
            type="button"
            onClick={() => onNavigate(nextTabId)}
            aria-label={isBackToTop ? `Scroll back to ${nextTabLabel}` : `Proceed to ${nextTabLabel}`}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#F97316] text-white font-bold text-xs md:text-sm hover:bg-[#EA580C] shadow-sm hover:shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
          >
            {isBackToTop ? (
              <>
                <ArrowUp size={16} className="shrink-0" />
                <span>{nextTabLabel}</span>
              </>
            ) : (
              <>
                <span>{nextTabLabel}</span>
                <ArrowRight size={16} className="shrink-0" />
              </>
            )}
          </button>
        ) : (
          <div />
        )}
      </div>
    </nav>
  )
}
