/**
 * RegisterPage — Registration with inline domain selection.
 * Users choose their workspace domain before entering the app.
 */
import { useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mail, Lock, Building, CheckCircle, Sparkles, Globe, Cpu, LayoutDashboard, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Building2, CreditCard, HeartPulse, Cloud, ShoppingCart, GraduationCap,
  Factory, Megaphone, ShieldCheck, Home, Laptop
} from 'lucide-react'
import { useDomain, GLOBAL_DOMAINS } from '../context/DomainContext'

const IconMap: Record<string, LucideIcon> = {
  Building2, CreditCard, HeartPulse, Cloud, ShoppingCart, GraduationCap,
  Factory, Megaphone, ShieldCheck, Home, Laptop, Sparkles
}

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [step, setStep] = useState<'credentials' | 'domain'>('credentials')
  const navigate = useNavigate()
  const domainContext = useDomain()

  const handleCredentials = (e: React.FormEvent) => {
    e.preventDefault()
    // Move to domain selection step
    setStep('domain')
  }

  const handleDomainSelect = (key: string) => {
    domainContext.setDomain(key)
    navigate('/app/analyze')
  }

  const handleCustomDomain = () => {
    if (domainContext.customDomain.trim()) {
      domainContext.setDomain('other')
      navigate('/app/analyze')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      {/* Centered two-column layout */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pt-16 pb-8">
        
        {/* ── LEFT PANEL (Authentication Card) ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="card p-8 md:p-12 flex flex-col justify-center relative overflow-hidden group hover:border-[var(--aurora)]/30 transition-colors duration-500"
        >
          {/* Subtle glow behind card */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[var(--aurora)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          
          <div className="relative z-10">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-depth)] border border-[var(--border-subtle)] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--aurora)] shadow-[0_0_8px_var(--aurora)] animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                Create Workspace
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] tracking-tight mb-4">
              {step === 'credentials' ? 'Create your ' : 'Choose your industry for '}
              <span className="gradient-text font-black">Qontint Workspace</span>
            </h1>
            
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-10 max-w-sm">
              {step === 'credentials'
                ? 'Create a free account to gain full access to Analyze, Generate, Intelligence, Graph, and Dashboard features.'
                : 'Select the primary industry you want to analyze content for.'
              }
            </p>

            <AnimatePresence mode="wait">
              {/* ── Step 1: Credentials ── */}
              {step === 'credentials' && (
                <motion.form
                  key="credentials"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleCredentials}
                  className="space-y-5"
                >
                  <div>
                    <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg-void)] border border-[var(--border-subtle)] focus:border-[var(--aurora)] rounded-lg text-sm transition-colors focus:outline-none text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg-void)] border border-[var(--border-subtle)] focus:border-[var(--aurora)] rounded-lg text-sm transition-colors focus:outline-none text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">Company Name</label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Acme Corp"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg-void)] border border-[var(--border-subtle)] focus:border-[var(--aurora)] rounded-lg text-sm transition-colors focus:outline-none text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button type="submit" className="btn-primary flex-1 py-3.5 text-sm flex items-center justify-center gap-2 group">
                      Create Account <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button type="button" onClick={() => navigate('/')} className="btn-secondary sm:w-auto px-6 py-3.5 text-sm">
                      Back to Home
                    </button>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
                    <p className="text-sm text-[var(--text-muted)]">
                      Already have an account?{' '}
                      <NavLink to="/login" className="text-[var(--aurora)] hover:text-[var(--plasma)] transition-colors font-semibold">
                        Login here
                      </NavLink>
                    </p>
                  </div>
                </motion.form>
              )}

              {/* ── Step 2: Domain Selection ── */}
              {step === 'domain' && (
                <motion.div
                  key="domain"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {GLOBAL_DOMAINS.filter(d => d.key !== 'other').map((d) => {
                      const Icon = IconMap[d.icon!] || Globe
                      const isSelected = domainContext.domain === d.key
                      return (
                        <button
                          key={d.key}
                          onClick={() => handleDomainSelect(d.key)}
                          className={`card p-4 flex flex-col items-start gap-2 transition-all duration-200 hover:-translate-y-0.5 text-left group relative ${
                            isSelected ? 'border-[var(--aurora)] shadow-[0_0_15px_rgba(232,137,74,0.2)]' : 'hover:border-[var(--aurora)]/50'
                          }`}
                        >
                          {isSelected && (
                            <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-[var(--aurora)]" />
                          )}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-[var(--aurora)]/20 border border-[var(--aurora)]/40'
                              : 'bg-[var(--bg-depth)] border border-[var(--border-subtle)] group-hover:bg-[var(--aurora)]/10 group-hover:border-[var(--aurora)]/30'
                          }`}>
                            <Icon className={`w-4 h-4 transition-colors ${isSelected ? 'text-[var(--aurora)]' : 'text-[var(--text-primary)] group-hover:text-[var(--aurora)]'}`} />
                          </div>
                          <div>
                            <p className={`font-bold text-sm transition-colors ${isSelected ? 'text-[var(--aurora)]' : 'text-[var(--text-primary)] group-hover:text-[var(--aurora)]'}`}>
                              {d.label}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="card p-4 mb-6 hover:border-[var(--aurora)]/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[var(--aurora)]" />
                      <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest">Custom Workspace</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-4 py-2.5 bg-[var(--bg-void)] border border-[var(--border-subtle)] focus:border-[var(--aurora)] rounded-lg text-sm transition-colors focus:outline-none text-[var(--text-primary)]"
                        placeholder="e.g. Clean Energy..."
                        value={domainContext.customDomain}
                        onChange={(e) => domainContext.setCustomDomain(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCustomDomain()}
                      />
                      <button
                        onClick={handleCustomDomain}
                        disabled={!domainContext.customDomain.trim()}
                        className="btn-secondary px-4 py-2.5 text-sm disabled:opacity-40"
                      >
                        Use
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setStep('credentials')}
                      className="btn-secondary flex-1 py-3 text-sm"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => {
                        if (!domainContext.hasSelectedWorkspace) domainContext.setDomain('b2b')
                        navigate('/app/analyze')
                      }}
                      className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2 group"
                    >
                      Enter Workspace <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── RIGHT PANEL (Workspace Benefits) ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="hidden lg:flex flex-col justify-center pl-8 lg:pl-16 relative"
        >
          <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--text-muted)] mb-8 flex items-center gap-3">
            <div className="w-8 h-px bg-[var(--border-subtle)]" />
            Workspace Benefits
          </h2>

          <div className="space-y-4 mb-12">
            {[
              {
                icon: Cpu,
                title: 'Semantic Scoring',
                desc: 'Analyze content with active domain-aware semantic scoring.'
              },
              {
                icon: LayoutDashboard,
                title: 'Unified Tools',
                desc: 'Move between Intelligence, Graph, YouTube, Keywords and Dashboard instantly.'
              },
              {
                icon: Shield,
                title: 'Isolated Environments',
                desc: 'Keep the public website and workspace completely separated.'
              }
            ].map((feature, idx) => (
              <div key={idx} className="card p-5 flex items-start gap-4 bg-[var(--bg-depth)]/50 border-[var(--border-subtle)] hover:border-[var(--aurora)]/20 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-black/40 border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-[var(--aurora)]" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-muted)]">
              Already have an account?{' '}
              <NavLink to="/login" className="text-[var(--aurora)] hover:text-[var(--plasma)] transition-colors font-semibold">
                Login here
              </NavLink>
            </p>
          </div>
        </motion.div>
        
      </div>
    </div>
  )
}
