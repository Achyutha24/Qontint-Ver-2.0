// @ts-nocheck
/**
 * GlobalNotificationCenter — Phase 7 Global Notification Popover
 *
 * Displays real-time automated updates across the workspace:
 *  - Analysis completed alerts
 *  - Report generation finished
 *  - Knowledge Graph synced
 *  - Competitor changes detected
 *  - Ranking score improvements
 *  - Mark as read, Clear, Filter functions
 */
import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, Trash2, CheckCircle2, AlertTriangle, Sparkles, X, Globe, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface NotificationItem {
  id: string
  title: string
  subtitle: string
  time: string
  read: boolean
  type: 'success' | 'warning' | 'info'
  route?: string
}

export default function GlobalNotificationCenter() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: 'n1', title: 'SERP Scan Complete', subtitle: 'Payment Gateway Security API ranked #2 in SERP Intel', time: '10 mins ago', read: false, type: 'success', route: '/app/serp-intel' },
    { id: 'n2', title: 'Executive Audit Report Ready', subtitle: 'B2B SaaS Production PDF generated (Grade A+)', time: '45 mins ago', read: false, type: 'info', route: '/app/reports' },
    { id: 'n3', title: 'ERP Graph Refreshed', subtitle: 'Indexed 55+ ERP platforms, modules, and process relationships', time: '3 hours ago', read: true, type: 'success', route: '/app/graph' },
    { id: 'n4', title: 'Action Required: Schema Missing', subtitle: 'ERP Cloud Architecture requires FAQPage schema', time: '5 hours ago', read: false, type: 'warning', route: '/app/generate' },

  ])

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const handleNotificationClick = (n: NotificationItem) => {
    setNotifications(notifications.map(item => item.id === n.id ? { ...item, read: true } : item))
    if (n.route) {
      navigate(n.route)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full bg-[var(--bg-depth)] border border-[var(--border-subtle)] hover:border-[var(--aurora)] text-[var(--text-primary)] transition-colors"
        title="Global Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--aurora)] text-white text-[9px] font-bold font-mono flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden z-[100]"
          >
            {/* Header */}
            <div className="p-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-depth)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[var(--text-primary)]">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[var(--aurora)]/10 text-[var(--aurora)]">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <button onClick={markAllAsRead} className="text-[var(--aurora)] hover:underline">Mark all read</button>
                <span className="text-[var(--text-muted)]">•</span>
                <button onClick={clearAll} className="text-slate-400 hover:text-red-500">Clear</button>
              </div>
            </div>

            {/* List */}
            <div className="p-2 max-h-80 overflow-y-auto space-y-1.5 bg-[var(--bg-void)]">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-muted)] font-mono">No notifications to display</div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer text-xs flex items-start gap-2.5 ${
                      !n.read ? 'bg-[var(--bg-card)] border-[var(--aurora)]/40' : 'bg-[var(--bg-depth)] border-[var(--border-subtle)] opacity-70'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                      n.type === 'success' ? 'bg-emerald-500' : n.type === 'warning' ? 'bg-amber-500' : 'bg-[var(--aurora)]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[var(--text-primary)] text-xs">{n.title}</h4>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{n.subtitle}</p>
                    </div>
                    <span className="text-[9px] font-mono text-[var(--text-muted)] flex-shrink-0">{n.time}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
