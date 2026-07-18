// @ts-nocheck
import React, { useMemo, useRef, useState, useEffect } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import dagre from 'cytoscape-dagre'
import { useTheme } from '../hooks/useTheme'

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
  TECHNOLOGY: '#38BDF8',
  ORG:        '#F4A261',
  PRODUCT:    '#A78BFA',
  PERSON:     '#22C55E',
  CONCEPT:    '#F59E0B',
  PROCESS:    '#14B8A6',
  STANDARD:   '#94A3B8',
  DEFAULT:    '#64748B',
}

function getColor(type: string | undefined): string {
  if (!type) return TYPE_COLORS.DEFAULT
  const color = TYPE_COLORS[type.toUpperCase()]
  if (color) return color
  
  const typeStr = type.toUpperCase()
  let hash = 0
  for (let i = 0; i < typeStr.length; i++) hash = typeStr.charCodeAt(i) + ((hash << 5) - hash)
  const colorKeys = Object.keys(TYPE_COLORS).filter(k => k !== 'DEFAULT')
  return TYPE_COLORS[colorKeys[Math.abs(hash) % colorKeys.length]]
}

export default function Graph2D({ nodes, edges, onNodeHover, onNodeClick, selectedId, layoutName = 'fcose' }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const cyRef = useRef<cytoscape.Core | null>(null)

  const elements = useMemo(() => {
    const cyNodes = nodes.map(n => ({
      data: {
        id: n.id,
        label: n.label,
        type: n.type,
        authority: n.authority,
        degree: n.degree || 0,
        cluster: n.cluster_id || 0,
        color: getColor(n.type)
      }
    }))
    
    const cyEdges = edges.map(e => ({
      data: {
        source: e.source,
        target: e.target,
        weight: e.weight
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
        'text-valign': 'center',
        'text-halign': 'right',
        'text-margin-x': 6,
        'width': 'mapData(authority, 0, 1, 20, 60)',
        'height': 'mapData(authority, 0, 1, 20, 60)',
        'border-width': 2,
        'border-color': isDark ? '#1e293b' : '#ffffff',
        'text-background-color': isDark ? '#0f172a' : '#ffffff',
        'text-background-opacity': 0.7,
        'text-background-padding': '4px',
        'text-background-shape': 'round-rectangle',
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 'mapData(weight, 0, 1, 1, 4)',
        'line-color': isDark ? '#334155' : '#cbd5e1',
        'curve-style': 'bezier',
        'opacity': 0.4
      }
    },
    {
      selector: '.selected',
      style: {
        'border-width': 4,
        'border-color': '#F4A261',
        'width': 'mapData(authority, 0, 1, 25, 70)',
        'height': 'mapData(authority, 0, 1, 25, 70)',
      }
    },
    {
      selector: '.neighbor',
      style: {
        'border-width': 3,
        'border-color': '#38BDF8',
      }
    },
    {
      selector: '.faded',
      style: {
        'opacity': 0.1
      }
    }
  ], [isDark])

  const layout = useMemo(() => {
    let name = layoutName
    if (name === 'fcose') {
      return {
        name: 'fcose',
        animate: true,
        animationDuration: 500,
        quality: 'default',
        randomize: false,
        fit: true,
        padding: 30,
        nodeRepulsion: 4500,
        idealEdgeLength: 100,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
      }
    }
    return {
      name,
      animate: true,
      animationDuration: 500
    }
  }, [layoutName])

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
        
        cy.animate({
          fit: { eles: selected.union(neighbors), padding: 50 },
          duration: 500
        })
      }
    } else {
      cy.animate({
        fit: { padding: 30, eles: cy.elements() },
        duration: 500
      })
    }
  }, [selectedId])

  return (
    <div className="w-full h-full relative" style={{ background: isDark ? 'var(--bg-void)' : '#f8fafc' }}>
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
        wheelSensitivity={0.2}
      />
    </div>
  )
}
