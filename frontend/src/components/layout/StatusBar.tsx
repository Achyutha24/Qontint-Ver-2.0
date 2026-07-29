import { useDomain } from '../../context/DomainContext'
import { ShieldCheck, Activity } from 'lucide-react'

export default function StatusBar() {
  const { activeDomainName } = useDomain()

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-depth)] px-4 py-2 text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          System Operational
        </span>
        <span className="text-[var(--border-subtle)]">|</span>
        <span className="flex items-center gap-1">
          <ShieldCheck size={12} className="text-[var(--aurora)]" />
          Workspace: <strong className="text-[var(--text-primary)]">{activeDomainName}</strong>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Activity size={12} className="text-[var(--text-muted)]" />
          Engine v2.4 Enterprise
        </span>
        <span className="text-[var(--border-subtle)]">|</span>
        <span className="text-[10px] opacity-75">Qontint Platform</span>
      </div>
    </footer>
  )
}
