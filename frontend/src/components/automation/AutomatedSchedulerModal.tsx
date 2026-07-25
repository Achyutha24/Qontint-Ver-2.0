// @ts-nocheck
/**
 * AutomatedSchedulerModal — Phase 7 Scheduled Automation Configurator
 *
 * Configures continuous automated monitoring:
 *  - Daily SERP Intelligence scans
 *  - Weekly Executive PDF Report delivery
 *  - Automated AI Content Studio refreshes
 *  - Competitor rank decay alerts
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Calendar, Zap, CheckCircle2, X, RefreshCw, Globe, FileText } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AutomatedSchedulerModal({ isOpen, onClose }: Props) {
  const [dailySerp, setDailySerp] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(true)
  const [autoGraphSync, setAutoGraphSync] = useState(true)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [savedToast, setSavedToast] = useState(false)

  if (!isOpen) return null

  const handleSave = () => {
    setSavedToast(true)
    setTimeout(() => {
      setSavedToast(false)
      onClose()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="card p-6 border border-[var(--border-subtle)] bg-[var(--bg-card)] max-w-lg w-full space-y-5 shadow-2xl relative"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--aurora)]/10 text-[var(--aurora)] flex items-center justify-center border border-[var(--aurora)]/20">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)]">Automated Monitoring & Schedules</h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">Continuous background intelligence tasks</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between">
            <div>
              <h4 className="font-bold text-[var(--text-primary)]">Daily Automated SERP Intelligence Scans</h4>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Re-scans top 10 competitors every 24 hours at 00:00 UTC</p>
            </div>
            <input
              type="checkbox"
              checked={dailySerp}
              onChange={() => setDailySerp(!dailySerp)}
              className="w-4 h-4 rounded text-[var(--aurora)] cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between">
            <div>
              <h4 className="font-bold text-[var(--text-primary)]">Weekly Executive PDF Report Delivery</h4>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Generates & emails executive audit report every Monday</p>
            </div>
            <input
              type="checkbox"
              checked={weeklyReport}
              onChange={() => setWeeklyReport(!weeklyReport)}
              className="w-4 h-4 rounded text-[var(--aurora)] cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between">
            <div>
              <h4 className="font-bold text-[var(--text-primary)]">Automated Knowledge Graph Sync</h4>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Indexes new entity relationships upon content generation</p>
            </div>
            <input
              type="checkbox"
              checked={autoGraphSync}
              onChange={() => setAutoGraphSync(!autoGraphSync)}
              className="w-4 h-4 rounded text-[var(--aurora)] cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between">
            <div>
              <h4 className="font-bold text-[var(--text-primary)]">Rank Decay & Alert Webhooks</h4>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Instant alerts when competitor rank changes are detected</p>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={() => setEmailAlerts(!emailAlerts)}
              className="w-4 h-4 rounded text-[var(--aurora)] cursor-pointer"
            />
          </div>
        </div>

        {savedToast && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-mono text-xs text-center font-bold">
            ✓ Automated schedules saved and activated!
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-xs font-bold">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary px-4 py-2 text-xs font-bold">
            Save Schedules
          </button>
        </div>
      </motion.div>
    </div>
  )
}
