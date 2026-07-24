import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Cpu, AlertTriangle } from 'lucide-react'
import * as THREE from 'three'
import { useThreeScene } from '../hooks/useThreeScene'
import { useTheme } from '../hooks/useTheme'
import { useScrollReveal } from '../hooks/useScrollReveal'

import MagneticButton from '../components/ui/MagneticButton'
import { useDomain } from '../context/DomainContext'
import CompetitorComparisonModal from '../components/ui/CompetitorComparisonModal'
import { normalizeAnalyzeResponse } from '../components/ui/ResultsPanel'
import type { AnalyzeResult } from '../components/ui/ResultsPanel'
import { apiFetch } from '../api/apiClient'





export default function AnalyzePage() {
  const [keyword, setKeyword] = useState('')
  const [content, setContent] = useState('')
  const { domain, activeDomainName } = useDomain()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const [loadingLogs, setLoadingLogs] = useState<string[]>([])
  
  const [wordCount, setWordCount] = useState(0)

  // Re-trigger scroll reveal when results are added to the DOM
  useScrollReveal([result])
  
  
  const { theme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useThreeScene(canvasRef, (scene, camera) => {
    const isDark = theme === 'dark'
    
    // Background Texture
    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = isDark ? 'rgba(232,137,74,0.05)' : 'rgba(212,129,58,0.1)'
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

    // Icosahedron (Neural Core)
    const coreGeo = new THREE.IcosahedronGeometry(4, 0)
    const positions = coreGeo.attributes.position.array
    const group = new THREE.Group()

    const darkColors = ['#E8894A', '#E3B06B', '#D69A6A']
    const lightColors = ['#E8894A', '#C97A45', '#E3B06B']
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
        color: isDark ? 0xE8894A : 0xE8894A, 
        transparent: true, 
        opacity: isDark ? 0.1 : 0.2 
      })
    )
    group.add(edges)
    scene.add(group)

    const light = new THREE.PointLight(isDark ? 0xE8894A : 0xffffff, isDark ? 2 : 1)
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
    setWordCount(content.trim() ? content.trim().split(/\s+/).length : 0)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const handleAnalyze = async () => {
    if (!keyword.trim() || !content.trim()) {
      setError('Please provide both keyword and content.')
      return
    }
    
    setIsAnalyzing(true)
    setError(null)
    setResult(null)
    setIsModalOpen(true)
    
    const stages = [
      '✓ Extracting entities',
      '✓ Running novelty scoring',
      '✓ Running ranking prediction',
      '✓ Searching live Google',
      '✓ Fetching Top 3 competitors',
      '✓ Extracting competitor content',
      '✓ Comparing articles',
      '✓ Running Gemini analysis',
      '✓ Building recommendations',
      '✓ Opening report'
    ]
    setLoadingLogs([stages[0]])
    
    let stageIdx = 1
    const logInterval = setInterval(() => {
      if (stageIdx < stages.length) {
        setLoadingLogs(prev => [...prev, stages[stageIdx]])
        stageIdx++
      }
    }, 1200)

    try {
      const data = await apiFetch<any>('/api/v1/analyze', {
        method: 'POST',
        body: JSON.stringify({ keyword, content, vertical: domain })
      })
      const normalized = normalizeAnalyzeResponse(data as Record<string, unknown>)
      setResult(normalized)
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.')
    } finally {
      clearInterval(logInterval)
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen pt-8 pb-20 px-4 relative">
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40" />

      <div 
        className="max-w-6xl mx-auto space-y-6 relative z-10"
        
      >
        <div className="mb-10 reveal">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-8 h-8 text-[var(--aurora)]" />
            <h1 className="page-title gradient-text">Neural Dissection Chamber</h1>
          </div>
          <p className="text-[var(--text-secondary)] max-w-2xl text-lg">
            Paste your content and target keyword. Qontint extracts entities, scores semantic novelty against live SERP data, and predicts your ranking position with confidence intervals.
          </p>
        </div>

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
                <div className="w-full px-4 py-2.5 text-sm rounded-lg border border-[var(--border-subtle)] bg-black/20 text-[var(--text-muted)] flex items-center justify-between h-[42px]">
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
                className="w-full px-4 py-3 text-sm resize-none min-h-[200px] leading-relaxed"
                placeholder="Paste your content here..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={8}
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
              <h3 className="font-display font-semibold text-[var(--text-primary)] mb-3">Pipeline Modules</h3>
              <div className="space-y-3">
                {[
                  { label: 'M2', name: 'Entity Extraction', desc: 'spaCy en_core_web_lg' },
                  { label: 'M4', name: 'Novelty Scorer', desc: '3-component weighted' },
                  { label: 'M5', name: 'Authority Calc.', desc: 'SQLite Authority Baseline' },
                  { label: 'M6', name: 'Ranking Predictor', desc: 'GradientBoosting ML' },
                ].map((m, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div 
                      className="w-7 h-7 rounded text-[var(--aurora)] border border-[var(--aurora)] flex items-center justify-center font-mono text-xs"
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
          </motion.div>
        </div>
      </div>

      <CompetitorComparisonModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        data={result}
        isLoading={isAnalyzing}
        error={error}
        loadingLogs={loadingLogs}
        userKeyword={keyword}
      />
    </div>
  )
}
