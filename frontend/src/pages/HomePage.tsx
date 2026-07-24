import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Network, Cpu, Shield, Zap, Search, Globe, Database, Building2, CreditCard, HeartPulse, Cloud, ShoppingCart, GraduationCap, Factory, Megaphone, ShieldCheck, Home, Laptop, Sparkles, CheckCircle, Briefcase } from 'lucide-react'

const IconMap: Record<string, LucideIcon> = {
  Building2, CreditCard, HeartPulse, Cloud, ShoppingCart, GraduationCap, Factory, Megaphone, ShieldCheck, Home, Laptop, Sparkles
}
import { useScrollReveal } from '../hooks/useScrollReveal'

import { useTheme } from '../hooks/useTheme'
import { MotionWrapper } from '../components/motion/MotionWrapper'
import { useDomain, GLOBAL_DOMAINS } from '../context/DomainContext'

// ── 3D Scene Component ──
function HomeHeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()
  
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const isMobile = window.innerWidth < 768
    const isDark = theme === 'dark'
    
    const numParticles = isDark ? (isMobile ? 2100 : 7000) : (isMobile ? 1200 : 4000)

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0)
    
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 15

    const mouse = { x: 0, y: 0 }
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(numParticles * 3)
    const colors = new Float32Array(numParticles * 3)
    const sizes = new Float32Array(numParticles)
    const velocities = new Float32Array(numParticles)
    const xSeeds = new Float32Array(numParticles)
    
    const darkPalette = [new THREE.Color('#E8894A'), new THREE.Color('#E3B06B'), new THREE.Color('#D69A6A'), new THREE.Color('#D69A6A')]
    const lightPalette = [new THREE.Color('#E8894A'), new THREE.Color('#C97A45'), new THREE.Color('#E3B06B')]
    const palette = isDark ? darkPalette : lightPalette

    for (let i = 0; i < numParticles; i++) {
      let z = isDark ? (i < numParticles * 0.35 ? Math.random() * 3 : (i < numParticles * 0.7 ? Math.random() * -4 - 2 : Math.random() * -6 - 6)) : (Math.random() - 0.5) * 15
      positions[i*3] = (Math.random() - 0.5) * 40
      positions[i*3+1] = (Math.random() - 0.5) * 20
      positions[i*3+2] = z
      const col = palette[Math.floor(Math.random() * palette.length)]
      colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b
      sizes[i] = isDark ? (Math.random() * 0.15 + 0.05) : (Math.random() * 0.08 + 0.04)
      velocities[i] = Math.random() * 0.01 + 0.005
      xSeeds[i] = Math.random() * Math.PI * 2
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1))
    geometry.setAttribute('xSeed', new THREE.BufferAttribute(xSeeds, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0, 0) }, uTheme: { value: isDark ? 1 : 0 } },
      vertexShader: `
        uniform float uTime; uniform vec2 uMouse; uniform float uTheme;
        attribute float size; attribute float velocity; attribute float xSeed; attribute vec3 color;
        varying vec3 vColor; varying float vTheme;
        void main() {
          vColor = color; vTheme = uTheme;
          vec3 pos = position;
          float t = uTime;
          pos.y += t * velocity * (uTheme > 0.5 ? 40.0 : 10.0);
          pos.x += sin(t * 0.5 + xSeed) * 0.2;
          pos.y = mod(pos.y + 15.0, 30.0) - 15.0;
          float d = distance(pos.xy, uMouse * 15.0);
          if (d < 5.0) {
            if (uTheme > 0.5) pos.xy += (uMouse * 15.0 - pos.xy) * (1.0 - d/5.0) * 0.08;
            else pos.xy -= (uMouse * 15.0 - pos.xy) * (1.0 - d/5.0) * 0.04;
          }
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor; varying float vTheme;
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          float strength = 1.0 - (dist * 2.0);
          gl_FragColor = vec4(vColor, strength * (vTheme > 0.5 ? 0.9 : 0.6));
        }
      `,
      transparent: true, blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    // ── INTELLIGENCE CORE ──
    const coreGroup = new THREE.Group()
    
    // 1. Inner Processing Unit
    const innerGeo = new THREE.SphereGeometry(1.2, 32, 32)
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    const innerCore = new THREE.Mesh(innerGeo, innerMat)
    coreGroup.add(innerCore)

    // 2. Crystalline Lattice (Icosahedron)
    const latticeGeo = new THREE.IcosahedronGeometry(2.5, 1)
    const latticeMat = new THREE.MeshBasicMaterial({ 
      color: 0xE8894A, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.4,
      blending: THREE.AdditiveBlending 
    })
    const lattice = new THREE.Mesh(latticeGeo, latticeMat)
    coreGroup.add(lattice)

    // 3. Neural Pulse Glow
    const pulseGeo = new THREE.SphereGeometry(2.8, 32, 32)
    const pulseMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xE8894A) }
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          float p = 0.5 + 0.5 * sin(uTime * 2.0);
          gl_FragColor = vec4(uColor, intensity * p * 0.4);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    })
    const pulse = new THREE.Mesh(pulseGeo, pulseMat)
    coreGroup.add(pulse)

    // 4. Data Constellation Beams
    const beamCount = 12
    const beams: THREE.Line[] = []
    for (let i = 0; i < beamCount; i++) {
      const beamGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 12, 0)
      ])
      const beamMat = new THREE.LineBasicMaterial({ 
        color: 0xE8894A, 
        transparent: true, 
        opacity: 0.1,
        blending: THREE.AdditiveBlending
      })
      const beam = new THREE.Line(beamGeo, beamMat)
      const angle = (i / beamCount) * Math.PI * 2
      beam.rotation.z = angle
      beam.rotation.x = Math.random() * Math.PI
      coreGroup.add(beam)
      beams.push(beam)
    }

    // 5. Orbiting Data Points
    const satGroup = new THREE.Group()
    const satCount = 8
    const satellites: THREE.Mesh[] = []
    for (let i = 0; i < satCount; i++) {
      const sGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15)
      const sMat = new THREE.MeshBasicMaterial({ color: 0xE3B06B })
      const s = new THREE.Mesh(sGeo, sMat)
      const dist = 4 + Math.random() * 2
      s.position.set(dist, 0, 0)
      const orbit = new THREE.Group()
      orbit.rotation.z = (i / satCount) * Math.PI * 2
      orbit.rotation.x = Math.random() * Math.PI
      orbit.add(s)
      satGroup.add(orbit)
      satellites.push(s)
    }
    coreGroup.add(satGroup)

    scene.add(coreGroup)

    let composer: EffectComposer | null = null
    if (isDark && !isMobile) {
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      const bloomStrength = isDark ? 0.8 : 0.2
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), bloomStrength, 0.4, 0.85))
    }

    const clock = new THREE.Clock()
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      material.uniforms.uTime.value = clock.getElapsedTime()
      const t = material.uniforms.uTime.value
      
      material.uniforms.uMouse.value.x += (mouse.x - material.uniforms.uMouse.value.x) * 0.15
      material.uniforms.uMouse.value.y += (mouse.y - material.uniforms.uMouse.value.y) * 0.15
      
      // Animate Intelligence Core
      coreGroup.rotation.y = t * 0.1
      lattice.rotation.x = t * 0.2
      lattice.rotation.y = t * 0.3
      pulse.material.uniforms.uTime.value = t
      
      innerCore.scale.setScalar(1 + Math.sin(t * 4) * 0.05)
      
      beams.forEach((beam, i) => {
        beam.rotation.y = t * 0.05 * (i % 2 === 0 ? 1 : -1)
        ;(beam.material as THREE.LineBasicMaterial).opacity = 0.05 + 0.05 * Math.sin(t * 2 + i)
      })

      satGroup.rotation.z = t * 0.1
      satellites.forEach((s) => {
        s.rotation.x = t * 2
        s.rotation.y = t * 2
      })

      if (composer) composer.render(); else renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      if (composer) composer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize); window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(raf); geometry.dispose(); material.dispose(); renderer.dispose(); scene.clear()
    }
  }, [theme])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />
}

function TypewriterEffect() {
  const words = ['authority grows', 'novelty scores', 'content ranks', 'SERP performs']
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setIndex(p => (p + 1) % words.length), 2500)
    return () => clearInterval(interval)
  }, [])
  const gradient = 'linear-gradient(90deg, #E8894A, #E3B06B)'
  return (
    <span className="inline-block min-w-[200px] sm:min-w-[400px]">
      <motion.span key={index} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
        className="font-bold" style={{ background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        {words[index]}_
      </motion.span>
    </span>
  )
}

export default function HomePage() {
  useScrollReveal()
  
  const navigate = useNavigate()
  const { theme } = useTheme()
  const domainContext = useDomain()

  return (
    <div className="text-[var(--text-primary)] transition-colors duration-300">
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <HomeHeroScene key={theme} />
        </AnimatePresence>

        <div className="relative z-10 container mx-auto px-6 text-center mt-16" >
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="semantic-badge mb-8 mx-auto w-fit">
            <span className="w-2 h-2 rounded-full bg-[var(--aurora)] animate-pulse shadow-[0_0_8px_var(--aurora)]" />
            SEMANTIC AUTHORITY OPERATING SYSTEM
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.1] mb-6">
            Know if your <br className="hidden md:block" />
            <TypewriterEffect />
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Qontint is a 100% free intelligence engine that measures semantic novelty, maps entity authority, and predicts your SERP ranking — before you publish.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button className="btn-primary w-full sm:w-auto px-10 py-4 text-lg flex items-center justify-center gap-2" onClick={() => navigate('/analyze')}>
              Analyze Content <ArrowRight className="w-5 h-5" />
            </button>
            <button className="btn-secondary w-full sm:w-auto px-10 py-4 text-lg flex items-center justify-center gap-2" onClick={() => navigate('/graph')}>
              <Network className="w-5 h-5" /> Explore Graph
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Workspace Selector ── */}
      <section className="py-12 container mx-auto px-6 relative z-10">
        <MotionWrapper className="max-w-6xl mx-auto">
          {!domainContext.hasSelectedWorkspace ? (
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <Briefcase className="w-8 h-8 text-[var(--aurora)]" /> Choose Your Workspace
              </h2>
              <p className="text-[var(--text-secondary)] max-w-2xl mx-auto text-sm leading-relaxed">
                Select your industry once. Qontint will personalize keyword research, SERP analysis, AI insights, competitor comparison, ranking prediction, and recommendations throughout the platform.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10 text-left">
                {GLOBAL_DOMAINS.filter(d => d.key !== 'other').map((d) => {
                  const Icon = IconMap[d.icon!] || Globe;
                  return (
                    <button
                      key={d.key}
                      onClick={() => domainContext.setDomain(d.key)}
                      className="card p-6 flex flex-col items-start gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(232,137,74,0.15)] hover:border-[var(--aurora)] group text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[var(--bg-depth)] border border-[var(--border-subtle)] flex items-center justify-center group-hover:bg-[var(--aurora)]/10 group-hover:border-[var(--aurora)]/30 transition-colors">
                        <Icon className="w-5 h-5 text-[var(--text-primary)] group-hover:text-[var(--aurora)] transition-colors" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--aurora)] transition-colors">{d.label}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">{d.desc}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-2 font-mono uppercase tracking-wider opacity-70 group-hover:opacity-100 transition-opacity">{d.examples}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 card p-6 max-w-md mx-auto hover:border-[var(--aurora)] transition-colors">
                <h3 className="font-bold text-sm mb-3 text-[var(--text-primary)] flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--aurora)]" /> Create Custom Workspace
                </h3>
                <input
                  type="text"
                  className="px-5 py-3 w-full bg-[var(--bg-void)] border border-[var(--border-subtle)] focus:border-[var(--aurora)] rounded-lg text-sm transition-colors text-center focus:outline-none"
                  placeholder="Enter industry (e.g. Clean Energy)"
                  value={domainContext.customDomain}
                  onChange={(e) => {
                    domainContext.setCustomDomain(e.target.value);
                    if (e.target.value.trim() !== '') {
                       domainContext.setDomain('other');
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="card p-5 max-w-md mx-auto flex items-center justify-between border-[var(--aurora)]/30 bg-gradient-to-r from-[var(--bg-depth)] to-transparent shadow-[0_0_20px_rgba(232,137,74,0.05)]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--aurora)]/10 border border-[var(--aurora)] flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-[var(--aurora)]" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Active Workspace</p>
                  <p className="font-bold text-[var(--text-primary)] leading-tight">{domainContext.activeDomainName}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                  const navBtn = document.querySelector('nav .lucide-briefcase')?.closest('button');
                  if (navBtn) navBtn.dispatchEvent(event);
                }}
                className="text-xs font-semibold text-[var(--aurora)] hover:text-[var(--plasma)] transition-colors px-3 py-1.5 rounded-full bg-[var(--aurora)]/10"
              >
                Change Workspace
              </button>
            </div>
          )}
        </MotionWrapper>
      </section>

      {/* ── Features Section (New) ── */}
      <section className="py-24 container mx-auto px-6">
        <MotionWrapper className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-4">Sophisticated Engine Architecture</h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Six modules working in concert to dissect your content at a semantic level and predict real-world SERP outcomes.</p>
        </MotionWrapper>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Search, title: 'Entity Extraction', desc: 'spaCy-powered NLP dissects content into high-value named entities and semantic concepts automatically.' },
            { icon: Globe, title: 'SERP Intelligence', desc: 'Scrapes live search results to establish what the top-ranking content currently covers for your keyword.' },
            { icon: Zap, title: 'Novelty Scoring', desc: 'Measures how much unique, non-redundant information your content adds to the existing conversation.' },
            { icon: Database, title: 'Authority Mapping', desc: 'Scores entity coverage against a curated B2B authority baseline to identify topical gaps.' },
            { icon: Shield, title: 'Ranking Prediction', desc: 'Gradient Boosting ML model predicts your SERP position with confidence intervals based on real signals.' },
            { icon: Cpu, title: 'Gemini AI Generation', desc: 'Iterative content generation loop powered by Gemini that refines until your novelty threshold is met.' },
          ].map((f, i) => (
            <MotionWrapper key={i} delay={i * 0.07}>
              <div className="card p-8 group h-full">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(232,137,74,0.1)', border: '1px solid rgba(232,137,74,0.2)' }}>
                  <f.icon className="w-5 h-5 text-[var(--aurora)]" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{f.desc}</p>
              </div>
            </MotionWrapper>
          ))}
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section className="py-24 container mx-auto px-6">
        <MotionWrapper>
          <div className="card p-12 text-center max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-around gap-8"
            style={{ background: 'linear-gradient(135deg, rgba(232,137,74,0.05) 0%, rgba(11,11,13,0.95) 100%)' }}>
            {[
              { n: '116+', l: 'Keywords Tracked' },
              { n: '4', l: 'B2B Verticals' },
              { n: '$0/mo', l: 'Operation Cost' },
              { n: '10s', l: 'Pipeline SLA' }
            ].map((s, i) => (
              <MotionWrapper key={i} delay={i * 0.1}>
                <div className="space-y-1">
                  <div className="stat-number glow-text">{s.n}</div>
                  <div className="text-[var(--text-muted)] text-sm uppercase tracking-widest font-mono">{s.l}</div>
                </div>
              </MotionWrapper>
            ))}
          </div>
        </MotionWrapper>
      </section>

      <footer className="py-12 text-center border-t border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-mono tracking-widest uppercase">
        © 2026 Qontint Intelligence Engine • Open Source MIT
      </footer>
    </div>
  )
}
