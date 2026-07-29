// @ts-nocheck
/**
 * NavigationContext — Global navigation state provider.
 * Manages sidebar open/close, pin mode, and command palette visibility.
 * Persists pinned state to localStorage.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

interface NavigationContextType {
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  toggleSidebar: () => void
  pinned: boolean
  togglePin: () => void
  closeSidebar: () => void
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (v: boolean) => void
  toggleCommandPalette: () => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem('qontint_sidebar_pinned') === 'true' } catch { return false }
  })
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), [])
  const togglePin = useCallback(() => {
    setPinned(v => {
      const next = !v
      try { localStorage.setItem('qontint_sidebar_pinned', String(next)) } catch {}
      return next
    })
  }, [])
  const closeSidebar = useCallback(() => { if (!pinned) setSidebarOpen(false) }, [pinned])
  const toggleCommandPalette = useCallback(() => setCommandPaletteOpen(v => !v), [])

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(v => !v)
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
        if (!pinned) setSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pinned])

  return (
    <NavigationContext.Provider value={{
      sidebarOpen, setSidebarOpen, toggleSidebar,
      pinned, togglePin,
      closeSidebar,
      commandPaletteOpen, setCommandPaletteOpen, toggleCommandPalette,
    }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider')
  return ctx
}
