/**
 * LandingNavbar — Public-facing navigation for the landing website.
 * Contains: Logo, Home (scroll), Features (scroll), Pricing, Login, Get Started.
 */
import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Network, Menu, X, ArrowRight } from 'lucide-react'

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

export default function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleSectionLink = (sectionId: string) => {
    setMobileOpen(false)
    if (location.pathname === '/') {
      scrollToSection(sectionId)
    } else {
      navigate('/', { state: { scrollTo: sectionId } })
    }
  }

  return (
    <nav className="glass-nav fixed top-0 left-0 right-0 z-[60] px-5 py-3 border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between w-full relative">

        {/* Logo */}
        <NavLink
          to="/"
          className="flex items-center gap-2 no-underline flex-shrink-0 group"
          onClick={() => setMobileOpen(false)}
        >
          <div className="relative w-9 h-9 flex items-center justify-center border border-[var(--aurora)] rounded-full transition-all duration-300 group-hover:shadow-[0_0_15px_var(--glow-aurora)]">
            <Network className="w-5 h-5 text-[var(--aurora)]" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-black text-xl text-[var(--text-primary)] tracking-tighter leading-none">Qontint</span>
            <span className="font-mono text-[9px] text-[var(--aurora)] opacity-80 uppercase tracking-[0.2em] mt-0.5">Engine v1.0</span>
          </div>
        </NavLink>

        {/* Desktop links */}
        <div className="hidden lg:flex flex-1 items-center justify-center gap-1 px-4">
          <button
            onClick={() => handleSectionLink('hero')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 no-underline border nav-link-base whitespace-nowrap"
          >
            Home
          </button>
          <button
            onClick={() => handleSectionLink('features')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 no-underline border nav-link-base whitespace-nowrap"
          >
            Features
          </button>
          <NavLink
            to="/pricing"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 no-underline border ${
                isActive ? 'nav-link-active' : 'nav-link-base'
              } whitespace-nowrap`
            }
          >
            Pricing
          </NavLink>
        </div>

        {/* Right side */}
        <div className="flex items-center justify-end gap-3 flex-shrink-0">
          <NavLink
            to="/login"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 no-underline border nav-link-base whitespace-nowrap"
          >
            Login
          </NavLink>
          <button
            className="btn-primary hidden md:flex items-center gap-1.5 px-4 py-1.5 text-sm"
            onClick={() => { navigate('/app/analyze') }}
          >
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-[var(--text-primary)] nav-link-base rounded-lg transition-colors"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-[var(--border-subtle)] mt-3 pt-3"
          >
            <div className="flex flex-col gap-2 pb-2">
              <button
                onClick={() => handleSectionLink('hero')}
                className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-bold no-underline transition-all border nav-link-base text-left"
              >
                Home
              </button>
              <button
                onClick={() => handleSectionLink('features')}
                className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-bold no-underline transition-all border nav-link-base text-left"
              >
                Features
              </button>
              <NavLink
                to="/pricing"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-bold no-underline transition-all border ${
                    isActive ? 'nav-link-active' : 'nav-link-base'
                  }`
                }
              >
                Pricing
              </NavLink>
              <NavLink
                to="/login"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-bold no-underline transition-all border ${
                    isActive ? 'nav-link-active' : 'nav-link-base'
                  }`
                }
              >
                Login
              </NavLink>
              <button
                className="btn-primary flex items-center justify-center gap-2 px-3 py-3 text-sm font-bold"
                onClick={() => { setMobileOpen(false); navigate('/app/analyze') }}
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
