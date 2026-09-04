// @ts-nocheck
import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'

export interface GraphNode {
  id: string
  label: string
  type: string
  vertical: string
  authority: number
  size?: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
  relation: string
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeHover: (node: GraphNode | null, x: number, y: number) => void
  onNodeClick: (node: GraphNode | null) => void
  selectedId: string | null
  overlayMode?: 'all' | 'gaps' | 'competitor'
}

// ── GPU INSTANCED ARCHITECTURE: MODULE-SCOPE REUSED GEOMETRIES & MATERIALS ────
const SHARED_SPHERE_GEO = new THREE.SphereGeometry(1, 16, 16)
const SHARED_GLOW_GEO = new THREE.SphereGeometry(1.25, 16, 16)

const INSTANCED_MAIN_MATERIAL = new THREE.MeshStandardMaterial({
  roughness: 0.3,
  metalness: 0.4,
  transparent: true,
  opacity: 0.92,
})

const INSTANCED_GLOW_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0.18,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})

function getNodeColor(typeStr: string | undefined, overlayMode?: string, authority?: number): string {
  if (overlayMode === 'gaps') {
    const auth = authority || 0.5
    if (auth > 0.8) return '#22C55E' // Green
    if (auth > 0.5) return '#F59E0B' // Yellow
    return '#EF4444' // Red
  }

  if (overlayMode === 'competitor') {
    const auth = authority || 0.5
    if (auth > 0.85) return '#22C55E' // Green
    if (auth > 0.6) return '#2563EB' // Blue
    return '#F97316' // Orange
  }

  const type = (typeStr || '').toUpperCase()
  if (type.includes('PLATFORM')) return '#F97316' // Aurora Orange
  if (type.includes('MODULE')) return '#2563EB' // Royal Blue
  if (type.includes('PROCESS')) return '#06B6D4' // Cyan
  if (type.includes('TECH')) return '#8B5CF6' // Purple
  if (type.includes('SEC') || type.includes('GOV')) return '#EF4444' // Red
  if (type.includes('INT')) return '#10B981' // Emerald Green
  if (type.includes('IMPL') || type.includes('MIG')) return '#F59E0B' // Amber
  if (type.includes('VENDOR') || type.includes('ORG')) return '#64748B' // Slate Gray
  if (type.includes('PRODUCT')) return '#F97316'
  return '#64748B'
}


// ── GPU INSTANCED MESH GRAPH SCENE ─────────────────────────────────────────────
function GraphScene({ nodes, edges, onNodeHover, onNodeClick, selectedId, overlayMode = 'all', isInteracting }: Props & { isInteracting: boolean }) {
  const { gl } = useThree()
  const controlsRef = useRef<any>(null)
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const glowMeshRef = useRef<THREE.InstancedMesh>(null)
  const linesRef = useRef<THREE.LineSegments>(null)

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Reusable matrix and color objects to avoid GC garbage collection allocations
  const dummyMatrix = useMemo(() => new THREE.Matrix4(), [])
  const dummyColor = useMemo(() => new THREE.Color(), [])

  // Profiler counters
  const lastTimeRef = useRef(performance.now())
  const framesRef = useRef(0)
  const raycastsRef = useRef(0)

  // Precompute 3D constellation positions ONCE for node count
  const nodeCount = Array.isArray(nodes) ? nodes.length : 0
  const positions = useMemo(() => {
    const posMap = new Map<string, THREE.Vector3>()
    if (!Array.isArray(nodes) || nodes.length === 0) return posMap

    nodes.forEach((node, idx) => {
      if (!node || !node.id) return
      const phi = Math.acos(-1 + (2 * idx) / Math.max(1, nodes.length))
      const theta = Math.sqrt(nodes.length * Math.PI) * phi
      const r = 55 + (idx / Math.max(1, nodes.length)) * 40
      const x = r * Math.cos(theta) * Math.sin(phi)
      const y = r * Math.sin(theta) * Math.sin(phi)
      const z = r * Math.cos(phi)
      posMap.set(node.id, new THREE.Vector3(x, y, z))
    })
    return posMap
  }, [nodeCount])

  // Pre-fill static line segments buffer ONCE
  const edgeCount = Array.isArray(edges) ? edges.length : 0
  const { edgePositions, edgeColors } = useMemo(() => {
    const count = Array.isArray(edges) ? edges.length : 0
    const pos = new Float32Array(count * 6)
    const col = new Float32Array(count * 6)
    const c = new THREE.Color('#CBD5E1')

    if (Array.isArray(edges)) {
      let idx = 0
      edges.forEach(e => {
        if (!e || !e.source || !e.target) return
        const src = positions.get(e.source)
        const tgt = positions.get(e.target)
        if (src && tgt) {
          pos[idx * 6] = src.x; pos[idx * 6 + 1] = src.y; pos[idx * 6 + 2] = src.z
          pos[idx * 6 + 3] = tgt.x; pos[idx * 6 + 4] = tgt.y; pos[idx * 6 + 5] = tgt.z

          col[idx * 6] = c.r; col[idx * 6 + 1] = c.g; col[idx * 6 + 2] = c.b
          col[idx * 6 + 3] = c.r; col[idx * 6 + 4] = c.g; col[idx * 6 + 5] = c.b
          idx++
        }
      })
    }
    return { edgePositions: pos, edgeColors: col }
  }, [edges, positions])

  // ── GPU INSTANCE MATRIX & COLOR UPDATE ──────────────────────────────────────
  // Executes ONLY when dataset, selection, or overlayMode changes!
  useEffect(() => {
    if (!instancedMeshRef.current || !Array.isArray(nodes) || nodes.length === 0) return

    const mesh = instancedMeshRef.current
    const glowMesh = glowMeshRef.current

    nodes.forEach((node, idx) => {
      if (!node || !node.id) return
      const pos = positions.get(node.id) || new THREE.Vector3()
      const isSelected = selectedId === node.id
      const isHovered = hoveredIndex === idx
      const baseR = 0.8 + (node.authority || 0.5) * 1.5
      const r = isSelected || isHovered ? baseR * 2.2 : baseR
      const colorHex = getNodeColor(node.type, overlayMode, node.authority)

      // Set main instance position and scale matrix
      dummyMatrix.makeScale(r, r, r)
      dummyMatrix.setPosition(pos)
      mesh.setMatrixAt(idx, dummyMatrix)

      // Set main instance color
      dummyColor.set(colorHex)
      mesh.setColorAt(idx, dummyColor)

      // Set glow aura instance
      if (glowMesh) {
        dummyMatrix.makeScale(r * 1.35, r * 1.35, r * 1.35)
        dummyMatrix.setPosition(pos)
        glowMesh.setMatrixAt(idx, dummyMatrix)
        glowMesh.setColorAt(idx, dummyColor)
      }
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    if (glowMesh) {
      glowMesh.instanceMatrix.needsUpdate = true
      if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true
    }
  }, [nodes, positions, selectedId, hoveredIndex, overlayMode, dummyMatrix, dummyColor])

  // Auto-Zoom on Selection
  useEffect(() => {
    if (selectedId && positions.has(selectedId) && controlsRef.current) {
      const targetPos = positions.get(selectedId)!
      controlsRef.current.target.lerp(targetPos, 0.6)
    }
  }, [selectedId, positions])

  // DIRECT DOM PROFILER REPORTING (Zero React re-renders)
  useFrame(() => {
    framesRef.current++
    const now = performance.now()
    const delta = now - lastTimeRef.current

    if (delta >= 500) {
      const fps = Math.round((framesRef.current * 1000) / delta)
      const frameTimeMs = parseFloat((delta / framesRef.current).toFixed(1))

      const fpsEl = document.getElementById('debug-fps')
      const ftEl = document.getElementById('debug-ft')
      const geoEl = document.getElementById('debug-geo')
      const matEl = document.getElementById('debug-mat')
      const dcEl = document.getElementById('debug-dc')
      const vertEl = document.getElementById('debug-vert')
      const rayEl = document.getElementById('debug-ray')

      if (fpsEl) fpsEl.innerText = `${fps} FPS`
      if (ftEl) ftEl.innerText = `${frameTimeMs} ms`
      if (geoEl) geoEl.innerText = `${gl.info.memory?.geometries || 2}`
      if (matEl) matEl.innerText = `${gl.info.memory?.materials || 2}`
      if (dcEl) dcEl.innerText = `${gl.info.render?.calls || 2}`
      if (vertEl) vertEl.innerText = `${gl.info.render?.vertices || 0}`
      if (rayEl) rayEl.innerText = `${raycastsRef.current * 2}`

      framesRef.current = 0
      raycastsRef.current = 0
      lastTimeRef.current = now
    }
  })

  // Selected & Hovered Node Objects for Selective Label Rendering
  const hoveredNode = hoveredIndex !== null && nodes[hoveredIndex] ? nodes[hoveredIndex] : null
  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) : null

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[40, 50, 60]} intensity={1.5} />
      <pointLight position={[60, 60, 60]} intensity={2.5} color="#F59E0B" />

      {/* ── GPU INSTANCED MESH FOR ALL NODES (1 DRAW CALL) ───────────────────── */}
      {nodeCount > 0 && (
        <instancedMesh
          ref={instancedMeshRef}
          args={[SHARED_SPHERE_GEO, INSTANCED_MAIN_MATERIAL, nodeCount]}
          onPointerMove={(e) => {
            e.stopPropagation()
            raycastsRef.current++
            if (e.instanceId !== undefined && e.instanceId !== null) {
              setHoveredIndex(e.instanceId)
              const node = nodes[e.instanceId]
              if (node) onNodeHover(node, e.clientX, e.clientY)
            }
          }}
          onPointerOut={(e) => {
            e.stopPropagation()
            setHoveredIndex(null)
            onNodeHover(null, 0, 0)
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (e.instanceId !== undefined && e.instanceId !== null) {
              const node = nodes[e.instanceId]
              if (node) onNodeClick(node)
            }
          }}
        />
      )}

      {/* ── GPU INSTANCED MESH FOR ALL GLOW AURAS (1 DRAW CALL) ──────────────── */}
      {nodeCount > 0 && (
        <instancedMesh
          ref={glowMeshRef}
          args={[SHARED_GLOW_GEO, INSTANCED_GLOW_MATERIAL, nodeCount]}
          raycast={() => null} // Disable raycasting on aura mesh
        />
      )}

      {/* ── SELECTIVE LABEL RENDERING (ONLY HOVERED OR SELECTED NODE) ───────── */}
      {!isInteracting && hoveredNode && (
        <Text
          position={[
            (positions.get(hoveredNode.id)?.x || 0),
            (positions.get(hoveredNode.id)?.y || 0) + 3,
            (positions.get(hoveredNode.id)?.z || 0)
          ]}
          fontSize={1.4}
          color="#0F172A"
          anchorX="center"
          anchorY="bottom"
        >
          {hoveredNode.label || hoveredNode.id}
        </Text>
      )}

      {!isInteracting && selectedNode && selectedNode.id !== hoveredNode?.id && (
        <Text
          position={[
            (positions.get(selectedNode.id)?.x || 0),
            (positions.get(selectedNode.id)?.y || 0) + 3,
            (positions.get(selectedNode.id)?.z || 0)
          ]}
          fontSize={1.4}
          color="#F97316"
          anchorX="center"
          anchorY="bottom"
        >
          {selectedNode.label || selectedNode.id}
        </Text>
      )}

      {/* ── STATIC EDGE CONNECTIONS (1 DRAW CALL) ────────────────────────────── */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edgePositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[edgeColors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={isInteracting ? 0.04 : (edges.length > 2000 ? 0.08 : 0.18)}
          depthWrite={false}
        />
      </lineSegments>

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={15}
        maxDistance={200}
      />
    </>
  )
}

export default React.memo(function Graph3D(props: Props) {
  const [isInteracting, setIsInteracting] = useState(false)

  return (
    <div
      onMouseDown={() => setIsInteracting(true)}
      onMouseUp={() => setIsInteracting(false)}
      onTouchStart={() => setIsInteracting(true)}
      onTouchEnd={() => setIsInteracting(false)}
      className="w-full h-full cursor-grab active:cursor-grabbing bg-transparent rounded-2xl overflow-hidden relative min-h-[550px]"
    >
      <Canvas
        camera={{ position: [0, 45, 110], fov: 45 }}
        frameloop="demand"
        dpr={[1, 1.25]}
        gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: false }}
      >
        <GraphScene {...props} isInteracting={isInteracting} />
      </Canvas>
    </div>
  )
})
