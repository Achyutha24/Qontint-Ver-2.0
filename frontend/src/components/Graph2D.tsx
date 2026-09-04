// @ts-nocheck
import React, { useMemo, useRef, useState, useEffect } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import dagre from 'cytoscape-dagre'
import { useTheme } from '../hooks/useTheme'
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react'

cytoscape.use(fcose)
cytoscape.use(dagre)

export interface GraphNode {
  id: string
  label: string
  type: string
  authority: number
  vertical: string
  degree?: number
  cluster_id?: number
  pagerank?: number
  details?: string
  val?: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
  relation: string
  relationship_weight?: number
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeHover: (node: GraphNode | null, x: number, y: number) => void
  onNodeClick: (node: GraphNode | null) => void
  selectedId: string | null
  layoutName?: string
}

const TYPE_COLORS: Record<string, string> = {
  PLATFORM:       '#F97316', // Aurora Orange
  MODULE:         '#2563EB', // Royal Blue
  PROCESS:        '#06B6D4', // Cyan
  TECHNOLOGY:     '#8B5CF6', // Purple
  SECURITY:       '#EF4444', // Red
  INTEGRATION:    '#10B981', // Emerald Green
  IMPLEMENTATION: '#F59E0B', // Amber
  VENDOR:         '#64748B', // Slate Gray
  DEFAULT:        '#3B82F6',
}

function getColor(type: string | undefined): string {
  if (!type) return TYPE_COLORS.DEFAULT
  const key = type.toUpperCase()
  if (TYPE_COLORS[key]) return TYPE_COLORS[key]
  if (key.includes('PLATFORM')) return TYPE_COLORS.PLATFORM
  if (key.includes('MODULE')) return TYPE_COLORS.MODULE
  if (key.includes('PROCESS')) return TYPE_COLORS.PROCESS
  if (key.includes('TECH')) return TYPE_COLORS.TECHNOLOGY
  if (key.includes('SEC') || key.includes('GOV')) return TYPE_COLORS.SECURITY
  if (key.includes('INT')) return TYPE_COLORS.INTEGRATION
  if (key.includes('IMPL') || key.includes('MIG')) return TYPE_COLORS.IMPLEMENTATION
  if (key.includes('VENDOR') || key.includes('ORG')) return TYPE_COLORS.VENDOR
  return TYPE_COLORS.DEFAULT
}


export default function Graph2D({ nodes, edges, onNodeHover, onNodeClick, selectedId, layoutName = 'fcose' }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [currentLayout, setCurrentLayout] = useState(layoutName)

  const elements = useMemo(() => {
    const cyNodes = nodes.map(n => ({
      data: {
        id: n.id,
        label: n.label,
        type: n.type,
        authority: n.authority || 50,
        degree: n.degree || 0,
        color: getColor(n.type)
      }
    }))
    
    const cyEdges = edges.map(e => ({
      data: {
        source: e.source,
        target: e.target,
        weight: e.weight || 0.7,
        label: (e.relation || '').replace(/_/g, ' ')
      }
    }))
    
    return [...cyNodes, ...cyEdges]
  }, [nodes, edges])

  const stylesheet = useMemo<any[]>(() => [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'label': 'data(label)',
        'color': isDark ? '#f8fafc' : '#0f172a',
        'font-family': 'Inter, sans-serif',
        'font-size': '10px',
        'font-weight': 'bold',
        'text-valign': 'center',
        'text-halign': 'right',
        'text-margin-x': 6,
        'width': 'mapData(authority, 0, 100, 16, 48)',
        'height': 'mapData(authority, 0, 100, 16, 48)',
        'border-width': 2,
        'border-color': isDark ? '#1e293b' : '#ffffff',
        'text-background-color': isDark ? '#0f172a' : '#ffffff',
        'text-background-opacity': 0.85,
        'text-background-padding': '4px',
        'text-background-shape': 'round-rectangle',
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 'mapData(weight, 0, 1, 1.5, 4)',
        'line-color': isDark ? '#334155' : '#cbd5e1',
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': isDark ? '#475569' : '#94a3b8',
        'arrow-scale': 0.8,
        'opacity': 0.5,
        'label': '',
        'font-size': '8px',
        'color': isDark ? '#64748b' : '#94a3b8',
        'text-rotation': 'autorotate',
        'text-margin-y': -6
      }
    },
    {
      selector: '.selected',
      style: {
        'border-width': 4,
        'border-color': '#F59E0B',
        'width': 'mapData(authority, 0, 100, 24, 60)',
        'height': 'mapData(authority, 0, 100, 24, 60)',
        'opacity': 1
      }
    },
    {
      selector: '.neighbor',
      style: {
        'border-width': 3,
        'border-color': '#3B82F6',
        'opacity': 0.95
      }
    },
    {
      selector: '.faded',
      style: {
        'opacity': 0.15
      }
    }
  ], [isDark])

  const layout = useMemo(() => {
    if (currentLayout === 'fcose') {
      const nodeCount = nodes.length
      const dense = nodeCount > 120
      return {
        name: 'fcose',
        // Do not animate the layout. Cytoscape animation + a 2,000-iteration
        // force solve was blocking the browser during 3D → 2D transitions.
        animate: false,
        quality: dense ? 'draft' : 'default',
        randomize: true,
        fit: true,
        padding: 30,
        nodeRepulsion: dense ? 3500 : 5000,
        idealEdgeLength: dense ? 70 : 90,
        edgeElasticity: dense ? 0.35 : 0.45,
        nestingFactor: 0.1,
        gravity: dense ? 0.45 : 0.25,
        numIter: dense ? 280 : 500,
      }
    }
    if (currentLayout === 'dagre') {
      return {
        name: 'dagre',
        animate: true,
        animationDuration: 400,
        rankDir: 'TB',
        nodeSep: 40,
        rankSep: 60,
        fit: true,
        padding: 30
      }
    }
    if (currentLayout === 'circle') {
      return {
        name: 'circle',
        animate: true,
        animationDuration: 400,
        fit: true,
        padding: 30
      }
    }
    return { name: currentLayout, animate: true, animationDuration: 400 }
  }, [currentLayout, nodes.length])

  useEffect(() => {
    if (!cyRef.current) return
    const cy = cyRef.current

    cy.elements().removeClass('selected neighbor faded')

    if (selectedId) {
      const selected = cy.getElementById(selectedId)
      if (selected.length > 0) {
        selected.addClass('selected')
        const neighbors = selected.neighborhood()
        neighbors.addClass('neighbor')
        
        cy.elements().difference(selected).difference(neighbors).addClass('faded')
        
        cy.fit(selected.union(neighbors), 50)
      }
    } else {
      cy.fit(cy.elements(), 30)
    }
  }, [selectedId])

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)
  const handleFit = () => cyRef.current?.fit(undefined, 30)

  return (
    <div className="w-full h-full relative" style={{ background: isDark ? 'var(--bg-void)' : '#f8fafc' }}>
      {/* Floating Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-[var(--bg-card)]/90 backdrop-blur border border-[var(--border-subtle)] p-1.5 rounded-xl shadow-lg">
        <select
          value={currentLayout}
          onChange={(e) => setCurrentLayout(e.target.value)}
          className="px-2 py-1 text-[11px] font-mono font-bold bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none"
        >
          <option value="fcose">Force (fcose)</option>
          <option value="dagre">Hierarchy (dagre)</option>
          <option value="circle">Radial (circle)</option>
        </select>
        <div className="h-4 w-px bg-[var(--border-subtle)] mx-0.5" />
        <button onClick={handleZoomIn} title="Zoom In" className="p-1.5 hover:bg-[var(--bg-depth)] rounded text-[var(--text-secondary)]">
          <ZoomIn size={14} />
        </button>
        <button onClick={handleZoomOut} title="Zoom Out" className="p-1.5 hover:bg-[var(--bg-depth)] rounded text-[var(--text-secondary)]">
          <ZoomOut size={14} />
        </button>
        <button onClick={handleFit} title="Fit to Screen" className="p-1.5 hover:bg-[var(--bg-depth)] rounded text-[var(--text-secondary)]">
          <Maximize2 size={14} />
        </button>
      </div>

      <CytoscapeComponent
        elements={elements}
        stylesheet={stylesheet}
        style={{ width: '100%', height: '100%' }}
        layout={layout}
        cy={(cy) => {
          cyRef.current = cy
          
          cy.on('tap', 'node', (e) => {
            const nodeData = e.target.data()
            const nodeInfo = nodes.find(n => n.id === nodeData.id) || null
            onNodeClick(nodeInfo)
          })
          
          cy.on('tap', (e) => {
            if (e.target === cy) {
              onNodeClick(null)
            }
          })
          
          cy.on('mouseover', 'node', (e) => {
            const nodeData = e.target.data()
            const nodeInfo = nodes.find(n => n.id === nodeData.id) || null
            const pos = e.renderedPosition || e.position
            onNodeHover(nodeInfo, pos.x, pos.y)
          })
          
          cy.on('mouseout', 'node', () => {
            onNodeHover(null, 0, 0)
          })
        }}
        // Cytoscape should not continuously animate a dense graph.
        wheelSensitivity={0.15}
      />
    </div>
  )
}
