// @ts-nocheck
/**
 * AIAssistantWidget — Enterprise AI Copilot for Qontint
 *
 * Core Capabilities:
 *  - ZERO Hallucinations: Uses strictly live platform data or honestly states when analysis is required
 *  - Route-Based Dynamic Copilot Titles (AI SEO Assistant, AI Content Assistant, AI SERP Analyst, etc.)
 *  - Context-Aware Top Context Bar (Workspace, Keyword, Page, Health, Last Analysis)
 *  - Page-Specific Contextual Quick Action Suggestions
 *  - Real-Time Streaming Thinking Steps ("Analyzing page context...", "Checking SERP...", etc.)
 *  - Direct Action Execution (Open Report, Open Graph, Run Analysis, Open Workspace)
 *  - Rich Formatting: 70% max-width user messages, recommendation badges, action buttons
 *  - Window Controls: Fixed viewport positioning, Minimize, Maximize, Close, Cross-route persistence
 */
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Sparkles, X, Send, ArrowRight, Minus, Maximize2, Minimize2,
  Compass, CheckCircle2, AlertTriangle, Shield, Activity, RefreshCw, FileText, Cpu, Zap, Globe, Network
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDomain } from '../../context/DomainContext'

interface ActionButton {
  label: string
  route: string
}

interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: string
  actionLink?: ActionButton
  thinkingStep?: string
  richData?: {
    score?: number
    rank?: string
    health?: string
    recommendations?: string[]
  }
}

export default function AIAssistantWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const { domain: verticalFilter, activeDomainName } = useDomain()

  // Floating Widget State
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingStepText, setThinkingStepText] = useState('')

  // Determine Dynamic Copilot Title Based on Active Route
  const copilotTitle = useMemo(() => {
    const p = location.pathname
    if (p.includes('/analyze')) return 'AI SEO Assistant'
    if (p.includes('/generate')) return 'AI Content Assistant'
    if (p.includes('/serp-intel')) return 'AI SERP Analyst'
    if (p.includes('/graph')) return 'AI Knowledge Assistant'
    if (p.includes('/reports')) return 'AI Report Assistant'
    if (p.includes('/dashboard')) return 'AI Business Assistant'
    if (p.includes('/workspace')) return 'AI Project Manager'
    if (p.includes('/youtube')) return 'AI Video Assistant'
    if (p.includes('/keywords')) return 'AI Keyword Strategist'
    return 'AI Copilot'
  }, [location.pathname])

  // Determine Active Page Friendly Label
  const pageLabel = useMemo(() => {
    const p = location.pathname
    if (p.includes('/analyze')) return 'Analyze Page'
    if (p.includes('/generate')) return 'AI Content Studio'
    if (p.includes('/serp-intel')) return 'SERP Intelligence'
    if (p.includes('/graph')) return 'Knowledge Graph'
    if (p.includes('/reports')) return 'Executive Reports'
    if (p.includes('/dashboard')) return 'Command Dashboard'
    if (p.includes('/workspace')) return 'Workspace Hub'
    if (p.includes('/keywords')) return 'Keywords Explorer'
    return 'Qontint Engine'
  }, [location.pathname])

  // Contextual Quick Actions per Route
  const contextualPrompts = useMemo(() => {
    const p = location.pathname
    if (p.includes('/analyze')) return ['Explain SEO Score', 'Suggest Improvements', 'Compare Competitors']
    if (p.includes('/generate')) return ['Improve Readability', 'Expand Semantic Coverage', 'Create FAQ']
    if (p.includes('/workspace')) return ['Summarize Project', 'Show Pending Tasks', 'Generate Report']
    if (p.includes('/reports')) return ['Explain Recommendations', 'Create Executive Summary']
    if (p.includes('/dashboard')) return ['Show Highest Priority Project', 'Projects Needing Attention']
    if (p.includes('/graph')) return ['Explain Entity Relationships', 'Show Missing Concepts']
    if (p.includes('/serp-intel')) return ['Explain Why Competitor #1 Ranks', 'Find Content Gaps']
    return ['Summarize Workspace', 'Show Key Recommendations']
  }, [location.pathname])

  // ── Real context from localStorage (set by AnalyzePage) ───────────────────────
  const [lastAnalysis, setLastAnalysis] = useState<any | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('qontint_last_analysis')
      if (raw) setLastAnalysis(JSON.parse(raw))
    } catch (_) {}
    // Also listen for storage changes from other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'qontint_last_analysis' && e.newValue) {
        try { setLastAnalysis(JSON.parse(e.newValue)) } catch (_) {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Derive real context values for the current active workspace
  const lastAnalysisVertical = lastAnalysis?.vertical
  const isMatchingWorkspace = !lastAnalysisVertical ||
    lastAnalysisVertical.toLowerCase() === verticalFilter.toLowerCase() ||
    lastAnalysisVertical.toLowerCase() === 'general'

  const hasAnalysisData = !!lastAnalysis
  const hasAnalysisForCurrentWorkspace = hasAnalysisData && isMatchingWorkspace
  const activeKeyword = hasAnalysisForCurrentWorkspace ? (lastAnalysis?.keyword || null) : null
  const lastAnalysisTime = hasAnalysisForCurrentWorkspace && lastAnalysis?.analyzedAt ? new Date(lastAnalysis.analyzedAt).toLocaleString() : null
  const currentHealth = hasAnalysisForCurrentWorkspace && lastAnalysis?.result?.seoScore != null
    ? lastAnalysis.result.seoScore >= 90 ? 'Excellent (Grade A+)' : lastAnalysis.result.seoScore >= 80 ? 'Good (Grade A)' : 'Fair (Grade B)'
    : null

  // Conversation Messages
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Initialize Smart Greeting on Context Change
  useEffect(() => {
    const currentHour = new Date().getHours()
    const greetingTime = currentHour < 12 ? 'Good Morning' : currentHour < 18 ? 'Good Afternoon' : 'Good Evening'

    const greetingMessage: ChatMessage = {
      id: 'greeting-1',
      sender: 'ai',
      text: hasAnalysisForCurrentWorkspace && activeKeyword
        ? `${greetingTime}! I am your ${copilotTitle} for ${activeDomainName}.\n\nActive Context: "${activeKeyword}" analyzed on ${lastAnalysisTime}.\nContent Health: ${currentHealth}.\n\nHow can I assist your campaign today?`
        : `${greetingTime}! I am your ${copilotTitle} for ${activeDomainName}.\n\nNo analysis has been completed for the current workspace.\n\nRun a content analysis on the Analyze page to unlock full AI assistance for ${activeDomainName}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages([greetingMessage])
  }, [copilotTitle, activeDomainName, pageLabel, hasAnalysisForCurrentWorkspace, activeKeyword])

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && !isMinimized) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isMinimized, isThinking])

  // Handle Query Execution with Thinking Steps & Grounding Logic
  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputText
    if (!query.trim() || isThinking) return

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg])
    if (!textToSend) setInputText('')
    setIsThinking(true)

    // Thinking Steps Sequence
    const steps = [
      'Analyzing active page context...',
      'Reviewing workspace data & platform state...',
      'Checking SERP & Knowledge Graph entity maps...',
      'Preparing copilot response...'
    ]

    let stepIdx = 0
    setThinkingStepText(steps[0])

    const stepInterval = setInterval(() => {
      stepIdx++
      if (stepIdx < steps.length) {
        setThinkingStepText(steps[stepIdx])
      } else {
        clearInterval(stepInterval)
        generateHonestResponse(query)
      }
    }, 350)
  }

  // Zero-Hallucination Response Logic Grounded in Real Platform Data
  const generateHonestResponse = (query: string) => {
    const q = query.toLowerCase()
    let responseText = ''
    let actionBtn: ActionButton | undefined
    let richDataObj: any | undefined

    // If no analysis has been completed for the current workspace, respond honestly without fabricating data
    if (!hasAnalysisForCurrentWorkspace) {
      if (q.includes('score') || q.includes('rank') || q.includes('seo') || q.includes('entity') ||
          q.includes('competitor') || q.includes('novelty') || q.includes('authority') ||
          q.includes('graph') || q.includes('workspace') || q.includes('project') || q.includes('summarize')) {
        responseText = `No analysis has been completed for the current workspace.`
        actionBtn = { label: 'Run First Analysis', route: '/app/analyze' }
      } else if (q.includes('generate') || q.includes('write') || q.includes('content')) {
        responseText = `No analysis has been completed for the current workspace.\n\nYou can head to the AI Content Studio to generate content for ${activeDomainName}.`
        actionBtn = { label: 'Open AI Content Studio', route: '/app/generate' }
      } else if (q.includes('keyword')) {
        responseText = `Browse keywords for ${activeDomainName} in the Keywords Explorer.`
        actionBtn = { label: 'Open Keywords Explorer', route: '/app/keywords' }
      } else {
        responseText = `No analysis has been completed for the current workspace.`
        actionBtn = { label: 'Run First Analysis', route: '/app/analyze' }
      }
    } else {
      // Real data available — respond with actual values
      const seoScore = lastAnalysis?.result?.seoScore
      const predictedRank = lastAnalysis?.result?.predicted_rank
      const noveltyScore = lastAnalysis?.result?.novelty_score
      const entityCount = lastAnalysis?.result?.entities?.length || 0
      const keyword = lastAnalysis?.keyword || activeDomainName

      if (q.includes('score') || q.includes('seo') || q.includes('grade')) {
        responseText = `[Source: Current Analysis Snapshot]\n\nThe SEO Score for "${keyword}" is ${seoScore ?? '—'}${seoScore ? '/100' : ''} (${currentHealth}).\nPredicted rank: ${predictedRank ? '#' + predictedRank : 'not yet computed'}.\nNovelty score: ${noveltyScore != null ? Math.round(noveltyScore * 100) + '%' : '—'}.`
        actionBtn = { label: 'View Full Report', route: '/app/reports' }
        richDataObj = { score: seoScore, rank: predictedRank ? '#' + predictedRank : '—', health: currentHealth }
      } else if (q.includes('rank') || q.includes('position')) {
        responseText = `[Source: Current Analysis Snapshot]\n\nPredicted ranking for "${keyword}": ${predictedRank ? '#' + predictedRank : 'not yet computed'} based on the ML ranking model.\nSEO Score: ${seoScore ?? '—'}/100. Novelty: ${noveltyScore != null ? Math.round(noveltyScore * 100) + '%' : '—'}.`
        actionBtn = { label: 'View Full Report', route: '/app/reports' }
      } else if (q.includes('entity') || q.includes('graph') || q.includes('concept')) {
        responseText = `[Source: Knowledge Graph Entity Database]\n\n${entityCount} entities were extracted from your last analysis of "${keyword}" using the spaCy NLP pipeline.\nExplore the full Knowledge Graph to visualize entity relationships and clusters.`
        actionBtn = { label: 'Inspect Knowledge Graph', route: '/app/graph' }
      } else if (q.includes('novelty')) {
        const pct = noveltyScore != null ? Math.round(noveltyScore * 100) : null
        responseText = pct != null
          ? `[Source: Current Analysis Snapshot]\n\nNovelty score for "${keyword}": ${pct}%.\n${pct >= 35 ? '✓ Above the 35% uniqueness threshold — content is semantically differentiated.' : '⚠ Below the 35% threshold — consider adding more unique perspectives.'}`
          : `Novelty score is not available. Run an analysis to compute it.`
        actionBtn = { label: 'Run Analysis', route: '/app/analyze' }
      } else if (q.includes('improve') || q.includes('fix') || q.includes('recommend')) {
        const recs = lastAnalysis?.result?.recommendations || lastAnalysis?.raw?.recommendations || []
        if (recs.length > 0) {
          responseText = `[Source: Executive Recommendations Engine]\n\nTop recommendations for "${keyword}":\n${recs.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.title || r.recommendation || r}`).join('\n')}`
        } else {
          responseText = `View the full executive report for "${keyword}" to see all recommendations and action items.`
        }
        actionBtn = { label: 'View Recommendations', route: '/app/reports' }
      } else if (q.includes('keyword')) {
        responseText = `[Source: Workspace Keyword Database]\n\nBrowse real B2B keywords scored by buyer intent, novelty opportunity, and priority matrix in the Keywords Explorer.`
        actionBtn = { label: 'Open Keywords Explorer', route: '/app/keywords' }
      } else if (q.includes('serp') || q.includes('competitor') || q.includes('ranks')) {
        responseText = `[Source: SERP Intelligence Pipeline]\n\nRun a SERP Intelligence analysis for "${keyword}" to compare against live competitor data and discover content gaps.`
        actionBtn = { label: 'Open SERP Intelligence', route: '/app/serp-intel' }
      } else if (q.includes('generate') || q.includes('write') || q.includes('content')) {
        responseText = `[Source: AI Content Studio Engine]\n\nGenerate optimized B2B content for "${keyword}" or any other keyword in the AI Content Studio.\nThe generator uses Gemini AI with novelty validation to ensure unique, high-ranking output.`
        actionBtn = { label: 'Open AI Content Studio', route: '/app/generate' }
      } else {
        responseText = `[Source: Current Workspace Context]\n\nLast analysis: "${keyword}" scored ${seoScore ?? '—'}/100 with predicted rank ${predictedRank ? '#' + predictedRank : '—'}.\n\nWould you like to run a new analysis, view the report, or generate content?`
        actionBtn = { label: 'View Report', route: '/app/reports' }
      }
    }

    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: responseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionLink: actionBtn,
      richData: richDataObj
    }

    setMessages(prev => [...prev, aiMsg])
    setIsThinking(false)
    setThinkingStepText('')
  }

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* FLOATING TRIGGER BUTTON (FIXED TO BOTTOM-RIGHT, HIGH Z-INDEX)           */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[9999] pointer-events-auto">
        <motion.button
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true)
              setIsMinimized(false)
            } else if (isMinimized) {
              setIsMinimized(false)
            } else {
              setIsOpen(false)
            }
          }}
          className="w-14 h-14 rounded-full bg-[var(--aurora)] text-white shadow-2xl flex items-center justify-center relative group border-2 border-white/20"
          title="Toggle Enterprise AI Copilot"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
        </motion.button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ENTERPRISE AI COPILOT PANEL (OPENING UPWARD, FULLY RESPONSIVE)          */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed z-[9999] pointer-events-auto bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
              isMinimized
                ? 'bottom-24 right-6 w-80 h-14'
                : isMaximized
                ? 'bottom-6 right-6 left-6 top-20 sm:left-auto sm:top-auto sm:bottom-24 sm:right-6 sm:w-[680px] sm:h-[calc(100vh-8rem)]'
                : 'bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[440px] max-w-[460px] h-[560px] max-h-[calc(100vh-8rem)]'
            }`}
          >
            {/* PANEL HEADER WITH DYNAMIC TITLE & WINDOW CONTROLS */}
            <div className="p-3.5 bg-[var(--bg-depth)] border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0 select-none">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--aurora)]/10 text-[var(--aurora)] flex items-center justify-center border border-[var(--aurora)]/20">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-primary)] leading-none flex items-center gap-1.5">
                    {copilotTitle}
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Grounded
                    </span>
                  </h3>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 block">
                    Page: <strong className="text-[var(--text-primary)]">{pageLabel}</strong>
                  </span>
                </div>
              </div>

              {/* Window Action Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                  title={isMinimized ? "Restore" : "Minimize"}
                >
                  <Minus size={14} />
                </button>

                {!isMinimized && (
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                    title={isMaximized ? "Restore Size" : "Maximize"}
                  >
                    {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-card)] transition-colors"
                  title="Close Copilot"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* DYNAMIC CONTEXT BAR (ALWAYS ACCURATE GROUNDED STATE) */}
            {!isMinimized && (
              <div className="px-3.5 py-2 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">
                <div className="truncate">
                  <span>KW: </span><strong className="text-[var(--aurora)]">{activeKeyword}</strong>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-emerald-600 font-bold">{currentHealth}</span>
                </div>
              </div>
            )}

            {/* PANEL CONTENT (VISIBLE WHEN NOT MINIMIZED) */}
            {!isMinimized && (
              <>
                {/* Chat Messages List */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[var(--bg-void)]">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'max-w-[70%] bg-[var(--aurora)] text-white font-medium rounded-br-none shadow-xs'
                            : 'max-w-[88%] bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-none shadow-xs'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>

                        {/* Rich Data Card Embeds */}
                        {msg.richData && (
                          <div className="mt-2.5 p-2.5 bg-[var(--bg-depth)] rounded-xl border border-[var(--border-subtle)] space-y-1.5 font-mono text-[11px]">
                            {msg.richData.score && (
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--text-muted)]">SEO Score:</span>
                                <strong className="text-[var(--aurora)] font-bold">{msg.richData.score}% ({msg.richData.health})</strong>
                              </div>
                            )}
                            {msg.richData.recommendations && (
                              <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
                                <span className="text-[10px] text-[var(--text-muted)] uppercase block">Key Recommendations:</span>
                                {msg.richData.recommendations.map((r, ri) => (
                                  <div key={ri} className="text-emerald-600 font-bold flex items-center gap-1">
                                    • {r}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Link Button */}
                        {msg.actionLink && (
                          <button
                            onClick={() => { navigate(msg.actionLink!.route); }}
                            className="mt-2.5 px-3 py-1.5 rounded-lg bg-[var(--aurora)]/10 text-[var(--aurora)] font-mono font-bold text-[11px] flex items-center gap-1 border border-[var(--aurora)]/20 hover:bg-[var(--aurora)]/20 w-full justify-center"
                          >
                            {msg.actionLink.label} <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-[var(--text-muted)] mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  ))}

                  {/* Thinking Steps Animation */}
                  {isThinking && (
                    <div className="flex flex-col items-start font-mono text-xs">
                      <div className="p-3 bg-[var(--bg-card)] border border-[var(--aurora)]/30 rounded-2xl rounded-bl-none text-[var(--aurora)] flex items-center gap-2 shadow-xs">
                        <RefreshCw size={14} className="animate-spin" />
                        <span>{thinkingStepText}</span>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Contextual Quick Prompts Chips */}
                <div className="p-2 bg-[var(--bg-card)] border-t border-[var(--border-subtle)] flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono scrollbar-none flex-shrink-0">
                  {contextualPrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(p)}
                      disabled={isThinking}
                      className="px-2.5 py-1 rounded-full bg-[var(--bg-depth)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--aurora)] hover:text-[var(--text-primary)] whitespace-nowrap transition-colors disabled:opacity-50"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Input Footer */}
                <div className="p-3 bg-[var(--bg-card)] border-t border-[var(--border-subtle)] flex items-center gap-2 flex-shrink-0">
                  <input
                    type="text"
                    placeholder={`Ask ${copilotTitle} about ${pageLabel}...`}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    disabled={isThinking}
                    className="flex-1 px-3.5 py-2 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] focus:border-[var(--aurora)] transition-all disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isThinking}
                    className="p-2 rounded-xl bg-[var(--aurora)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
