import { useEffect, useState } from 'react'
import { Bell, Bot, Check, Palette, RotateCcw, SlidersHorizontal } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import ContentContainer from '../components/layout/ContentContainer'

const SETTINGS_KEY = 'qontint_preferences'

type Preferences = {
  assistantEnabled: boolean
  compactMode: boolean
  notifications: boolean
}

const DEFAULTS: Preferences = {
  assistantEnabled: true,
  compactMode: false,
  notifications: true,
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) setPreferences({ ...DEFAULTS, ...JSON.parse(raw) })
    } catch (_) {
      // Keep safe defaults when preferences are unavailable.
    }
  }, [])

  const update = (key: keyof Preferences, value: boolean) => {
    const next = { ...preferences, [key]: value }
    setPreferences(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  const reset = () => {
    setPreferences(DEFAULTS)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULTS))
    localStorage.removeItem('qontint_last_analysis')
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <PageContainer>
      <PageHeader badge="PLATFORM SETTINGS" title="Settings" subtitle="Control Qontint interface preferences and workspace behaviour. Changes are stored locally in this browser." />
      <ContentContainer>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--solar)] text-[var(--aurora)] flex items-center justify-center border border-[var(--aurora)]/20">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <h2 className="text-lg">Interface</h2>
                <p className="text-sm text-[var(--text-muted)]">Personalise the application experience.</p>
              </div>
            </div>

            <div className="space-y-2">
              <SettingToggle icon={Bot} title="AI Assistant" description="Show the grounded AI assistant on application pages." checked={preferences.assistantEnabled} onChange={v => update('assistantEnabled', v)} />
              <SettingToggle icon={SlidersHorizontal} title="Compact layout" description="Reduce spacing in dense tables and dashboards." checked={preferences.compactMode} onChange={v => update('compactMode', v)} />
              <SettingToggle icon={Bell} title="Notifications" description="Allow Qontint notification surfaces to appear." checked={preferences.notifications} onChange={v => update('notifications', v)} />
            </div>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                <Palette size={18} />
              </div>
              <div>
                <h2 className="text-lg">Appearance</h2>
                <p className="text-sm text-[var(--text-muted)]">Qontint currently uses the light enterprise theme.</p>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">Light enterprise</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Navy/slate surfaces with Qontint orange as the primary action colour.</p>
                </div>
                <span className="tag text-emerald-600 border-emerald-200 bg-emerald-50">Active</span>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
              <strong>Design note:</strong> Qontint keeps orange for primary actions while using cooler slate and blue surfaces for information, which improves hierarchy and reduces visual fatigue.
            </div>
          </section>

          <section className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg">Browser data</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">Reset local preferences and the last-analysis context stored by Qontint.</p>
              </div>
              <button onClick={reset} className="btn-secondary inline-flex items-center gap-2">
                <RotateCcw size={15} /> Reset local preferences
              </button>
            </div>
            {saved && (
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <Check size={15} /> Saved
              </div>
            )}
          </section>
        </div>
      </ContentContainer>
    </PageContainer>
  )
}

function SettingToggle({ icon: Icon, title, description, checked, onChange }: { icon: any; title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-depth)] p-3 transition-colors cursor-pointer">
      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0"><Icon size={16} /></div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <span className="relative w-10 h-6 rounded-full bg-slate-300 peer-checked:bg-[var(--aurora)] transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  )
}
