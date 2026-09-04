import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Cpu, AlertTriangle } from 'lucide-react'
import * as THREE from 'three'
import { useThreeScene } from '../hooks/useThreeScene'
import { useTheme } from '../hooks/useTheme'
import { useScrollReveal } from '../hooks/useScrollReveal'

import MagneticButton from '../components/ui/MagneticButton'
import { useDomain } from '../context/DomainContext'
import { normalizeAnalyzeResponse } from '../components/ui/ResultsPanel'
import type { AnalyzeResult } from '../components/ui/ResultsPanel'
import { apiFetch } from '../api/apiClient'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import ContentContainer from '../components/layout/ContentContainer'
import { saveReportToRepository } from '../utils/reportRepository'

export default function AnalyzePage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [content, setContent] = useState('')
  const { domain, activeDomainName } = useDomain()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(0)

  // Re-trigger scroll reveal when results are added to the DOM
  useScrollReveal([result])

  const { theme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useThreeScene(canvasRef, (scene, camera) => {
    const isDark = theme === 'dark'
    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = isDark ? 'rgba(249,115,22,0.05)' : 'rgba(212,129,58,0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      ctx.lineTo(64 + 60 * Math.cos(i * Math.PI / 3), 64 + 60 * Math.sin(i * Math.PI / 3))
    }
    ctx.closePath()
    ctx.stroke()
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(20, 20)
    scene.background = null 

    const coreGeo = new THREE.IcosahedronGeometry(4, 0)
    const positions = coreGeo.attributes.position.array
    const group = new THREE.Group()

    const darkColors = ['#F97316', '#F59E0B', '#FFEDD5']
    const lightColors = ['#F97316', '#EA580C', '#F59E0B']
    const colors = isDark ? darkColors : lightColors
    const nodes: THREE.Mesh[] = []

    for (let i = 0; i < positions.length; i += 3) {
      if (Math.random() > 0.3) continue
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06),
        new THREE.MeshStandardMaterial({ 
          color: colors[Math.floor(Math.random() * colors.length)],
          emissive: colors[Math.floor(Math.random() * colors.length)],
          emissiveIntensity: isDark ? 0.5 : 0.2
        })
      )
      mesh.position.set(positions[i], positions[i+1], positions[i+2])
      mesh.userData.targetPos = mesh.position.clone()
      mesh.position.set(0,0,0)
      mesh.userData.idx = i
      nodes.push(mesh)
      group.add(mesh)
    }

    const edges = new THREE.LineSegments(
      coreGeo,
      new THREE.LineBasicMaterial({ 
        color: isDark ? 0xF97316 : 0xF97316, 
        transparent: true, 
        opacity: isDark ? 0.1 : 0.2 
      })
    )
    group.add(edges)
    scene.add(group)

    const light = new THREE.PointLight(isDark ? 0xF97316 : 0xffffff, isDark ? 2 : 1)
    light.position.set(10, 10, 10)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.2 : 0.5))
    
    camera.position.z = 15
    return { group, nodes, tex }
  }, (state, clock, mousePos) => {
    const { group, nodes } = state
    const t = clock.getElapsedTime()
    const isDark = theme === 'dark'

    group.rotation.y += 0.002
    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(mousePos.y * 0.3, mousePos.x * 0.3, 0))
    group.quaternion.slerp(targetQuat, 0.05)

    nodes.forEach((node: THREE.Mesh) => {
      node.position.lerp(node.userData.targetPos, 0.05)
      const scale = 0.8 + 0.4 * Math.sin(t * 2 + node.userData.idx * 0.5)
      node.scale.setScalar(scale)
      
      if (isAnalyzing) {
        const wave = Math.sin(t * 5 + node.userData.idx * 0.1)
        ;(node.material as THREE.MeshStandardMaterial).emissiveIntensity = wave > 0.8 ? (isDark ? 2.5 : 1.5) : 0.2
      } else {
        ;(node.material as THREE.MeshStandardMaterial).emissiveIntensity = isDark ? 0.5 : 0.2
      }
    })
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  useEffect(() => {
    if (!content) {
      setWordCount(0)
      return
    }
    const words = content.trim().match(/\S+/g)
    setWordCount(words ? words.length : 0)
  }, [content])

  const handleAnalyze = async () => {
    if (!keyword.trim() || !content.trim()) {
      setError('Please provide both keyword and content.')
      return
    }
    
    setIsAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const data = await apiFetch<any>('/api/v1/analyze', {
        method: 'POST',
        body: JSON.stringify({ keyword, content, vertical: domain })
      })
      const normalized = normalizeAnalyzeResponse(data as Record<string, unknown>)
      setResult(normalized)

      // Keep the assistant/report context aligned with the actual Analyze result.
      // The API returns authority + novelty as 0–1 values rather than a top-level
      // seoScore, so persist the same transparent composite used by the report
      // repository instead of leaving the assistant with a misleading null.
      const derivedSeoScore = Math.round(
        ((normalized.authority?.authority_score ?? 0) * 0.5 +
          (normalized.novelty?.novelty_score ?? 0) * 0.5) * 100
      )

      const snapshot = {
        keyword,
        vertical: domain,
        analyzedAt: new Date().toISOString(),
        result: { ...normalized, seoScore: derivedSeoScore },
        raw: data,
      }
      localStorage.setItem('qontint_last_analysis', JSON.stringify(snapshot))
      saveReportToRepository({
        title: `Neural SEO Audit: ${keyword}`,
        keyword,
        type: 'Analyze',
        category: 'Content Audit',
        domain,
        score: Math.round(((normalized.authority?.authority_score || 0.8) * 0.5 + (normalized.novelty?.novelty_score || 0.4) * 0.5) * 100),
        rank: `#${normalized.ranking?.predicted_rank || 3}`,
        payload: snapshot,
        originalRoute: '/app/analyze'
      })

      // Architectural Refactor: Navigate to standalone Report Route!
      // React Router completely unmounts AnalyzePage & AppLayout!
      navigate('/app/analyze/report', { state: { keyword, result: normalized } })
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <PageContainer>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40" />

      <PageHeader
        title="Content Analyzer"
        subtitle="Enter your target keyword and content. Qontint runs a live SERP intelligence pipeline — extracting entities, scoring semantic authority, and revealing keyword-specific content gaps against top-ranking competitors."
        badge="SERP Intelligence"
        icon={Cpu}
      />

      <ContentContainer>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 reveal">
          <motion.div
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}
            className="lg:col-span-3 space-y-4"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                  Target Keyword
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 text-sm"
                  placeholder="e.g. AP automation software"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />
              </div>
              <div className="sm:w-1/3">
                <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                  Global Domain
                </label>
                <div className="w-full px-4 py-2.5 text-sm rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-depth)] text-[var(--text-muted)] flex items-center justify-between h-[42px]">
                  <span className="truncate">{activeDomainName}</span>
                  <span className="w-2 h-2 rounded-full bg-[var(--aurora)] shadow-[0_0_8px_var(--aurora)] animate-pulse" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Content
                </label>
                <span className={`font-mono text-xs ${wordCount < 50 ? 'text-[var(--solar)]' : 'text-[var(--text-muted)]'}`}>
                  {wordCount} words
                </span>
              </div>
              <textarea
                ref={textareaRef}
                className="w-full px-4 py-3 text-sm h-[360px] sm:h-[400px] lg:h-[440px] overflow-y-auto custom-scroll resize-none leading-relaxed rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:border-[var(--aurora)] focus:outline-none transition-colors"
                placeholder="Paste your content here..."
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            </div>

            <MagneticButton
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm"
              onClick={handleAnalyze}
              disabled={isAnalyzing || content.length < 50 || !keyword.trim()}
            >
              {isAnalyzing ? 'Running Pipeline…' : <><Cpu className="w-4 h-4" /> Analyze Content</>}
            </MagneticButton>

            {error && (
              <div 
                className="card border-[var(--solar)] p-4 flex gap-3 text-[var(--solar)]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--solar) 5%, transparent)' }}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}
            className="lg:col-span-2 space-y-4"
          >
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--text-primary)] mb-1">Analysis Pipeline</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">Powered by spaCy NLP & SERP Intelligence</p>
              <div className="space-y-3">
                {[
                  { label: 'NLP', name: 'Entity Extraction', desc: 'spaCy en_core_web_lg — extracts orgs, products, concepts' },
                  { label: 'SEM', name: 'Semantic Baseline', desc: 'Cross-competitor topic & cluster analysis' },
                  { label: 'GAP', name: 'Knowledge Gap Engine', desc: 'Domain-aware gap detection vs. SERP leaders' },
                  { label: 'REC', name: 'Recommendation Engine', desc: 'Evidence-based SEO recommendations' },
                ].map((m, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div 
                      className="w-9 h-7 rounded text-[var(--aurora)] border border-[var(--aurora)] flex items-center justify-center font-mono text-[10px] tracking-wider flex-shrink-0"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--aurora) 10%, transparent)' }}
                    >
                      {m.label}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{m.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--text-primary)] mb-3">How to use</h3>
              <ol className="space-y-2 text-xs text-[var(--text-muted)] list-decimal list-inside">
                <li>Enter the exact keyword you want to rank for</li>
                <li>Paste your draft content in the editor</li>
                <li>Click <span className="text-[var(--aurora)] font-medium">Analyze Content</span> to run the pipeline</li>
                <li>Review your semantic gaps, competitor insights &amp; recommendations</li>
              </ol>
            </div>
          </motion.div>
        </div>
      </ContentContainer>
    </PageContainer>
  )
}
