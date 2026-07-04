/**
 * LandingLayout — Wraps all public/landing pages.
 * Contains: LandingNavbar + <Outlet /> + Footer.
 * Handles scroll-to-section from navigation state.
 */
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import LandingNavbar from '../components/landing/LandingNavbar'

function LandingFooter() {
  return (
    <footer className="py-12 text-center border-t border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-mono tracking-widest uppercase">
      © 2026 Qontint Intelligence Engine • Open Source MIT
    </footer>
  )
}

export default function LandingLayout() {
  const location = useLocation()

  // Handle scroll-to-section when navigated from another route
  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null
    if (state?.scrollTo) {
      // Allow page to render first
      const timer = setTimeout(() => {
        const el = document.getElementById(state.scrollTo!)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [location])

  return (
    <div className="text-[var(--text-primary)] transition-colors duration-300">
      <LandingNavbar />
      <main>
        <Outlet />
      </main>
      <LandingFooter />
    </div>
  )
}
