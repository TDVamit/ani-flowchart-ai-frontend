import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  SelectionMode,
  NodeTypes,
  EdgeTypes,
  ConnectionMode,
  useReactFlow,
  ReactFlowInstance,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useFlowchartStore, selectNodes, selectEdges, setAxisLock, selectCurrentLevel, selectLevelPath, nodesForLevel, edgesForNodes } from '../../store/useFlowchartStore'
import type { FlowNode, FlowEdge } from '../../store/useFlowchartStore'
import type { ScreenData } from '../../types/flowchart'
import { ScreenNode }      from './nodes/ScreenNode'
import { ElementNode }     from './nodes/ElementNode'
import { AnimatedEdge }    from './edges/AnimatedEdge'
import { Toolbar }         from './panels/Toolbar'
import { ConfigPanel }     from './panels/ConfigPanel'
import { AnimationPlayer } from './animation/AnimationPlayer'
import { StepViewer }      from './animation/StepViewer'
import { AIGenerateModal } from './AIGenerateModal'
import { PresentationContext } from './PresentationContext'
import type { NodeAnimState } from './PresentationContext'

const nodeTypes: NodeTypes = {
  screen:  ScreenNode  as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  element: ElementNode as any, // eslint-disable-line @typescript-eslint/no-explicit-any
}

const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge as any, // eslint-disable-line @typescript-eslint/no-explicit-any
}

type BgTexture = 'dots' | 'lines' | 'cross' | 'none'

const BG_OPTIONS: { value: BgTexture; label: string }[] = [
  { value: 'dots',  label: 'Dots'  },
  { value: 'lines', label: 'Lines' },
  { value: 'cross', label: 'Cross' },
  { value: 'none',  label: 'None'  },
]

const BG_VARIANT: Record<BgTexture, BackgroundVariant | null> = {
  dots:  BackgroundVariant.Dots,
  lines: BackgroundVariant.Lines,
  cross: BackgroundVariant.Cross,
  none:  null,
}

// ── Tiny button helper ────────────────────────────────────────────────────────

function TopBtn({
  onClick, children, primary, danger,
}: {
  onClick: () => void
  children: React.ReactNode
  primary?: boolean
  danger?: boolean
}) {
  const bg     = primary ? '#6366f1' : danger ? '#fef2f2' : '#ffffff'
  const color  = primary ? '#ffffff' : danger  ? '#ef4444' : '#475569'
  const border = primary ? '#6366f1' : danger  ? '#fecaca' : '#e2e8f0'

  return (
    <button
      onClick={onClick}
      style={{
        padding:      '6px 14px',
        background:    bg,
        border:       `1px solid ${border}`,
        borderRadius:  5,
        color,
        cursor:        'pointer',
        fontFamily:   'IBM Plex Mono, monospace',
        fontSize:      12,
        fontWeight:    primary ? 700 : 500,
        transition:   'opacity .12s',
        whiteSpace:   'nowrap',
      }}
      onMouseEnter={(e) => { (e.currentTarget).style.opacity = '0.82' }}
      onMouseLeave={(e) => { (e.currentTarget).style.opacity = '1' }}
    >
      {children}
    </button>
  )
}

// ── RfCapture: captures ReactFlow instance after mount ────────────────────────

function RfCapture({ onReady }: { onReady: (rf: ReactFlowInstance) => void }) {
  const rf = useReactFlow()
  useEffect(() => { onReady(rf) }, []) // eslint-disable-line
  return null
}

// ── Level Switcher Button ────────────────────────────────────────────────────

function LevelSwitcher({ allNodes, currentLevel, jumpToLevel }: {
  allNodes: FlowNode[]
  currentLevel: number
  jumpToLevel: (level: number) => void
}) {
  const availableLevels = useMemo(() => {
    const levels = new Set<number>()
    for (const n of allNodes) {
      if (n.type === 'screen') {
        levels.add(((n.data as ScreenData).level ?? 1))
      }
    }
    return Array.from(levels).sort((a, b) => a - b)
  }, [allNodes])

  const currentIdx = availableLevels.indexOf(currentLevel)
  const total = availableLevels.length

  // Neighbors: distance 1 (immediate) and distance 2 (faded)
  const prev1 = currentIdx > 0 ? availableLevels[currentIdx - 1] : null
  const prev2 = currentIdx > 1 ? availableLevels[currentIdx - 2] : null
  const next1 = currentIdx < total - 1 ? availableLevels[currentIdx + 1] : null
  const next2 = currentIdx < total - 2 ? availableLevels[currentIdx + 2] : null

  // Animate text labels — not the pill shell
  const prev2Ref = useRef<HTMLDivElement>(null)
  const prev1Ref = useRef<HTMLDivElement>(null)
  const pillTextRef = useRef<HTMLDivElement>(null)
  const next1Ref = useRef<HTMLDivElement>(null)
  const next2Ref = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLElement>(null)
  const prevLevelRef = useRef(currentLevel)

  useEffect(() => {
    if (prevLevelRef.current === currentLevel) return
    const dir = currentLevel > prevLevelRef.current ? 'up' : 'down'
    prevLevelRef.current = currentLevel
    const cls = `ls-anim-${dir}`
    for (const ref of [prev2Ref, prev1Ref, pillTextRef, next1Ref, next2Ref]) {
      const el = ref.current
      if (!el) continue
      el.classList.remove('ls-anim-up', 'ls-anim-down')
      void el.offsetHeight
      el.classList.add(cls)
    }
    // Play lordicon animation by simulating hover trigger
    const icon = iconRef.current as any
    if (icon) {
      // lordicon hover trigger listens for mouseenter/mouseleave
      icon.dispatchEvent(new MouseEvent('mouseenter'))
      setTimeout(() => icon.dispatchEvent(new MouseEvent('mouseleave')), 800)
    }
  }, [currentLevel])

  if (total <= 1) return null

  const mono = 'IBM Plex Mono, monospace'

  const neighborBtn = (level: number, opacity: number, scale: number, color: string, fontSize: number) => (
    <button
      onClick={() => jumpToLevel(level)}
      style={{
        border: 'none', background: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', gap: 3,
        opacity, transition: 'opacity 0.3s, transform 0.3s', transform: `scale(${scale})`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = String(opacity); e.currentTarget.style.transform = `scale(${scale})` }}
    >
      <div style={{ width: fontSize * 0.7, height: fontSize * 0.7, borderRadius: '50%', background: color }} />
      <span style={{ fontFamily: mono, fontSize, fontWeight: 600, color, lineHeight: 1 }}>L{level}</span>
    </button>
  )

  // Fixed layout: neighbors are positioned relative to the current indicator
  // so adding/removing neighbors never shifts the indicator's position
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Neighbors above */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginBottom: 4 }}>
        <div style={{ height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {prev2 !== null && <div ref={prev2Ref}>{neighborBtn(prev2, 0.25, 0.8, '#a5b4fc', 8)}</div>}
        </div>
        <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {prev1 !== null && <div ref={prev1Ref}>{neighborBtn(prev1, 0.55, 0.92, '#818cf8', 9)}</div>}
        </div>
      </div>

      {/* Current level — indigo card with icon */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '2px 12px 2px 6px',
        background: '#6366f1',
        borderRadius: 8,
        boxShadow: '0 0 10px rgba(99, 102, 241, 0.5), 0 0 24px rgba(99, 102, 241, 0.15)',
      }}>
        {React.createElement('lord-icon', {
          ref: iconRef,
          src: 'https://cdn.lordicon.com/jectmwqf.json',
          trigger: 'hover',
          stroke: 'bold',
          colors: 'primary:#ffffff,secondary:#c7d2fe',
          style: { width: 20, height: 20, flexShrink: 0, margin: '-2px' },
        })}
        <div style={{ overflow: 'hidden' }}>
          <div ref={pillTextRef}>
            <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', lineHeight: 1, letterSpacing: '0.04em' }}>
              L{currentLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Neighbors below */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginTop: 4 }}>
        <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {next1 !== null && <div ref={next1Ref}>{neighborBtn(next1, 0.5, 0.92, '#94a3b8', 9)}</div>}
        </div>
        <div style={{ height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {next2 !== null && <div ref={next2Ref}>{neighborBtn(next2, 0.2, 0.8, '#b0bec5', 8)}</div>}
        </div>
      </div>
    </div>
  )
}

// ── Canvas View Overlay (read-only canvas, same as public link) ───────────────

function CanvasViewOverlay({ onClose }: { onClose: () => void }) {
  const allNodes = useFlowchartStore(selectNodes)
  const allEdges = useFlowchartStore(selectEdges)
  const [viewLevel, setViewLevel] = useState(1)
  const [viewPath, setViewPath] = useState<Array<{ level: number; label: string; screenId?: string; sourceElementId?: string }>>([])
  const [fitKey, setFitKey] = useState(0)
  const [fitTargetId, setFitTargetId] = useState<string | null>(null)

  const levelNodes = useMemo(() => nodesForLevel(allNodes, viewLevel), [allNodes, viewLevel])
  const levelNodeIds = useMemo(() => new Set(levelNodes.map((n) => n.id)), [levelNodes])
  const levelEdges = useMemo(() => edgesForNodes(allEdges, levelNodeIds), [allEdges, levelNodeIds])

  const roNodes = levelNodes.map((n) => ({
    ...n,
    selected: false,
    draggable: false,
    zIndex: n.type === 'screen' ? -1 : Math.max(1, (n.zIndex as number | undefined) ?? 1),
  }))

  // Determine fitView target: specific screen/element, or first screen as fallback
  const fitViewOpts = (() => {
    if (fitTargetId) {
      // Drilling down: focus on the specific screen
      return { padding: 0.3, includeHiddenNodes: false, nodes: [{ id: fitTargetId }] }
    }
    const firstScreen = levelNodes
      .filter((n) => n.type === 'screen')
      .sort((a, b) => ((a.data as ScreenData).order ?? 0) - ((b.data as ScreenData).order ?? 0))[0]
    return firstScreen
      ? { padding: 0.8, includeHiddenNodes: false, nodes: [{ id: firstScreen.id }] }
      : { padding: 0.8 }
  })()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (viewLevel > 1) { handleBack(); } else { onClose() } } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, viewLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for drill-down events from ElementNode expand icons
  useEffect(() => {
    const handler = (e: CustomEvent<{ elementId: string }>) => {
      const elNode = allNodes.find((n) => n.id === e.detail.elementId)
      if (!elNode) return
      const expandedScreenId = (elNode.data as any).expandedScreenId // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!expandedScreenId) return
      const screen = allNodes.find((n) => n.id === expandedScreenId)
      if (!screen) return
      const screenData = screen.data as ScreenData
      const targetLevel = screenData.level ?? 1
      setViewLevel(targetLevel)
      setViewPath((p) => [...p, { level: targetLevel, label: screenData.label, screenId: expandedScreenId, sourceElementId: e.detail.elementId }])
      setFitTargetId(expandedScreenId)
      setFitKey((k) => k + 1)
    }
    window.addEventListener('fc-drill-down' as any, handler as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    return () => window.removeEventListener('fc-drill-down' as any, handler as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [allNodes])

  function handleBack() {
    const currentEntry = viewPath[viewPath.length - 1]
    const sourceElId = currentEntry?.sourceElementId
    const targetLevel = viewPath.length <= 1 ? 1 : viewPath[viewPath.length - 2].level

    if (viewPath.length <= 1) {
      setViewLevel(1)
      setViewPath([])
    } else {
      const newPath = viewPath.slice(0, -1)
      setViewLevel(newPath[newPath.length - 1].level)
      setViewPath(newPath)
    }

    // Find parent screen of source element to focus on it
    if (sourceElId) {
      const targetNodes = nodesForLevel(allNodes, targetLevel)
      const sourceEl = targetNodes.find((n) => n.id === sourceElId)
      if (sourceEl) {
        const cx = sourceEl.position.x + (sourceEl.width ?? 120) / 2
        const cy = sourceEl.position.y + (sourceEl.height ?? 50) / 2
        const parentScreen = targetNodes.find((n) => {
          if (n.type !== 'screen') return false
          const sx = n.position.x, sy = n.position.y
          const sw = n.width ?? 534, sh = n.height ?? 300
          return cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh
        })
        if (parentScreen) {
          setFitTargetId(parentScreen.id)
          setFitKey((k) => k + 1)
          return
        }
      }
    }
    setFitTargetId(null)
    setFitKey((k) => k + 1)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 45, zIndex: 10,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {viewLevel > 1 && (
            <button
              onClick={handleBack}
              style={{
                padding: '3px 8px', background: 'none', border: '1px solid #c7d2fe',
                borderRadius: 4, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 10, color: '#6366f1', fontWeight: 600,
              }}
            >
              &larr; Back
            </button>
          )}
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1' }} />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color: '#1e293b', letterSpacing: '0.08em' }}>
            CANVAS VIEW
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5,
            color: '#475569', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 500,
          }}
        >
          Close
        </button>
      </div>

      {/* Canvas */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 45 }}>
        {/* Floating back button on canvas */}
        {viewLevel > 1 && (
          <button
            onClick={handleBack}
            style={{
              position: 'absolute', top: 57, left: 12, zIndex: 30,
              padding: '5px 12px', background: 'rgba(255,255,255,0.95)', border: '1px solid #c7d2fe',
              borderRadius: 5, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11, color: '#6366f1', fontWeight: 600,
              backdropFilter: 'blur(6px)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            &larr; Back
          </button>
        )}
        {/* Level switcher */}
        <div style={{ position: 'absolute', top: 57, right: 0, zIndex: 30 }}>
          <LevelSwitcher allNodes={allNodes} currentLevel={viewLevel} jumpToLevel={(lvl) => {
            if (lvl < viewLevel) {
              // Going back — trim path
              const idx = viewPath.findIndex(e => e.level === lvl)
              if (idx >= 0) { setViewLevel(lvl); setViewPath(viewPath.slice(0, idx + 1)) }
              else { setViewLevel(lvl); setViewPath([]) }
            } else {
              setViewLevel(lvl)
            }
            setFitTargetId(null)
            setFitKey(k => k + 1)
          }} />
        </div>
        <ReactFlowProvider key={fitKey}>
          <PresentationContext.Provider value={{ presentationMode: false, nodeStates: {}, showSteps: false, showDebug: false }}>
            <ReactFlow
              nodes={roNodes}
              edges={levelEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{ type: 'animatedEdge' }}
              nodesDraggable={false}
              nodesConnectable={false}
              nodesFocusable={false}
              elementsSelectable={false}
              connectionMode={ConnectionMode.Loose}
              panOnDrag
              panOnScroll
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              fitView
              fitViewOptions={fitViewOpts}
              style={{ background: '#f8fafc' }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable style={{ border: '1px solid #e2e8f0' }} />
            </ReactFlow>
          </PresentationContext.Provider>
        </ReactFlowProvider>
      </div>
    </div>
  )
}

// ── Read-only canvas with level navigation ───────────────────────────────────

function ReadOnlyCanvas({ allNodes, allEdges, bgVariant, topOffset = 0 }: {
  allNodes: FlowNode[]
  allEdges: FlowEdge[]
  bgVariant: BackgroundVariant | null
  topOffset?: number
}) {
  const [viewLevel, setViewLevel] = useState(1)
  const [viewPath, setViewPath] = useState<Array<{ level: number; label: string; screenId?: string; sourceElementId?: string }>>([])
  const [fitKey, setFitKey] = useState(0)
  const [fitTargetId, setFitTargetId] = useState<string | null>(null)

  const lvlNodes = useMemo(() => nodesForLevel(allNodes, viewLevel), [allNodes, viewLevel])
  const lvlNodeIds = useMemo(() => new Set(lvlNodes.map((n) => n.id)), [lvlNodes])
  const lvlEdges = useMemo(() => edgesForNodes(allEdges, lvlNodeIds), [allEdges, lvlNodeIds])

  const roNodes = lvlNodes.map((n) => ({
    ...n,
    selected: false,
    draggable: false,
    zIndex: n.type === 'screen' ? -1 : Math.max(1, (n.zIndex as number | undefined) ?? 1),
  }))

  const fitViewOpts = (() => {
    if (fitTargetId) {
      // Drilling down: focus on the specific screen
      return { padding: 0.3, includeHiddenNodes: false, nodes: [{ id: fitTargetId }] }
    }
    const firstScreen = lvlNodes
      .filter((n) => n.type === 'screen')
      .sort((a, b) => ((a.data as ScreenData).order ?? 0) - ((b.data as ScreenData).order ?? 0))[0]
    return firstScreen
      ? { padding: 0.8, includeHiddenNodes: false, nodes: [{ id: firstScreen.id }] }
      : { padding: 0.8 }
  })()

  // Listen for drill-down events from ElementNode expand icons
  useEffect(() => {
    const handler = (e: CustomEvent<{ elementId: string }>) => {
      const elNode = allNodes.find((n) => n.id === e.detail.elementId)
      if (!elNode) return
      const expandedScreenId = (elNode.data as any).expandedScreenId // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!expandedScreenId) return
      const screen = allNodes.find((n) => n.id === expandedScreenId)
      if (!screen) return
      const screenData = screen.data as ScreenData
      const targetLevel = screenData.level ?? 1
      setViewLevel(targetLevel)
      setViewPath((p) => [...p, { level: targetLevel, label: screenData.label, screenId: expandedScreenId, sourceElementId: e.detail.elementId }])
      setFitTargetId(expandedScreenId)
      setFitKey((k) => k + 1)
    }
    window.addEventListener('fc-drill-down' as any, handler as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    return () => window.removeEventListener('fc-drill-down' as any, handler as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [allNodes])

  function handleBack() {
    const currentEntry = viewPath[viewPath.length - 1]
    const sourceElId = currentEntry?.sourceElementId
    const targetLevel = viewPath.length <= 1 ? 1 : viewPath[viewPath.length - 2].level

    if (viewPath.length <= 1) {
      setViewLevel(1)
      setViewPath([])
    } else {
      const newPath = viewPath.slice(0, -1)
      setViewLevel(newPath[newPath.length - 1].level)
      setViewPath(newPath)
    }

    // Find parent screen of source element to focus on it
    if (sourceElId) {
      const targetNodes = nodesForLevel(allNodes, targetLevel)
      const sourceEl = targetNodes.find((n) => n.id === sourceElId)
      if (sourceEl) {
        const cx = sourceEl.position.x + (sourceEl.width ?? 120) / 2
        const cy = sourceEl.position.y + (sourceEl.height ?? 50) / 2
        const parentScreen = targetNodes.find((n) => {
          if (n.type !== 'screen') return false
          const sx = n.position.x, sy = n.position.y
          const sw = n.width ?? 534, sh = n.height ?? 300
          return cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh
        })
        if (parentScreen) {
          setFitTargetId(parentScreen.id)
          setFitKey((k) => k + 1)
          return
        }
      }
    }
    setFitTargetId(null)
    setFitKey((k) => k + 1)
  }

  return (
    <PresentationContext.Provider value={{ presentationMode: false, nodeStates: {}, showSteps: false, showDebug: false }}>
      <div style={{ position: 'absolute', inset: 0, background: '#f8fafc' }}>
        {/* Back button — outside fitKey so it doesn't remount */}
        {viewLevel > 1 && (
          <button
            onClick={handleBack}
            style={{
              position: 'absolute', top: topOffset + 12, left: 12, zIndex: 10,
              padding: '5px 12px', background: 'rgba(255,255,255,0.95)', border: '1px solid #c7d2fe',
              borderRadius: 5, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11, color: '#6366f1', fontWeight: 600,
              backdropFilter: 'blur(6px)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            &larr; Back
          </button>
        )}

        {/* Level switcher — outside fitKey so animations persist */}
        <div style={{ position: 'absolute', top: topOffset, right: 0, zIndex: 10 }}>
          <LevelSwitcher allNodes={allNodes} currentLevel={viewLevel} jumpToLevel={(lvl) => {
            if (lvl < viewLevel) {
              const idx = viewPath.findIndex(e => e.level === lvl)
              if (idx >= 0) { setViewLevel(lvl); setViewPath(viewPath.slice(0, idx + 1)) }
              else { setViewLevel(lvl); setViewPath([]) }
            } else {
              setViewLevel(lvl)
            }
            setFitTargetId(null)
            setFitKey(k => k + 1)
          }} />
        </div>

        <ReactFlow
          key={fitKey}
          nodes={roNodes}
          edges={lvlEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'animatedEdge' }}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          connectionMode={ConnectionMode.Loose}
          panOnDrag
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          fitView
          fitViewOptions={fitViewOpts}
          style={{ background: '#f8fafc' }}
          proOptions={{ hideAttribution: true }}
        >
          {bgVariant && <Background variant={bgVariant} gap={16} size={1} color="#e2e8f0" />}
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable style={{ border: '1px solid #e2e8f0' }} />
        </ReactFlow>
      </div>
    </PresentationContext.Provider>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────────

interface FlowCanvasProps {
  presentationMode?: boolean
  readOnly?: boolean
  readOnlyTopOffset?: number
  presentationNodeStates?: Record<string, NodeAnimState>
  onRfReady?: (rf: ReactFlowInstance) => void
  presentationInitialViewport?: { x: number; y: number; zoom: number }
}

export default function FlowCanvas({ presentationMode = false, readOnly = false, readOnlyTopOffset = 0, presentationNodeStates, onRfReady, presentationInitialViewport }: FlowCanvasProps) {
  const allNodes = useFlowchartStore(selectNodes)
  const allEdges = useFlowchartStore(selectEdges)
  const currentLevel = useFlowchartStore(selectCurrentLevel)
  const levelPath    = useFlowchartStore(selectLevelPath)
  const { onNodesChange, onEdgesChange, onConnect, selectNode, selectEdge, saveChart, activeChartId, pasteElements, updateNode, pushHistory, undo, redo, drillUp, navigateToLevel, jumpToLevel } = useFlowchartStore()

  // Rendered level lags behind currentLevel to allow exit animation on old content
  const [renderLevel, setRenderLevel] = useState(currentLevel)

  // Level-filtered nodes/edges for editor view (uses renderLevel, not currentLevel)
  const levelNodes = useMemo(() => nodesForLevel(allNodes, renderLevel), [allNodes, renderLevel])
  const levelNodeIds = useMemo(() => new Set(levelNodes.map((n) => n.id)), [levelNodes])
  const levelEdges = useMemo(() => edgesForNodes(allEdges, levelNodeIds), [allEdges, levelNodeIds])

  // Use all nodes for presentation/readOnly, level-filtered for editor
  const nodes = (presentationMode || readOnly) ? allNodes : levelNodes
  const edges = (presentationMode || readOnly) ? allEdges : levelEdges

  const rf = useReactFlow()
  const navigate = useNavigate()
  const [showPlayer,   setShowPlayer]   = useState(false)
  const [showCanvasView, setShowCanvasView] = useState(false)
  const [showSteps,    setShowSteps]    = useState(false)
  const [showAIModal,  setShowAIModal]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [savedAt,    setSavedAt]      = useState<string | null>(null)
  const [bgTexture,  setBgTexture]    = useState<BgTexture>('dots')
  const [snapEnabled,  setSnapEnabled]  = useState(true)
  const [stepBadges,   setStepBadges]   = useState(false)
  const [autoSave,     setAutoSave]     = useState(true)
  const [showDebug,    setShowDebug]    = useState(false)
  const [snapGuides, setSnapGuides]   = useState<{ vx: number[]; hy: number[] }>({ vx: [], hy: [] })
  const [ctrlDown,   setCtrlDown]     = useState(false)
  const [shareId,    setShareId]      = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)

  // Canvas zoom animation on level change
  const [canvasScale, setCanvasScale] = useState(1)
  const [canvasOpacity, setCanvasOpacity] = useState(1)
  const [canvasTransition, setCanvasTransition] = useState('none')
  const prevLevelAnimRef = useRef(currentLevel)
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const animContextRef = useRef<{ goingDeeper: boolean; drillBackElementId: string | null } | null>(null)
  const prevLevelPathRef = useRef(levelPath)
  useEffect(() => {
    if (prevLevelAnimRef.current !== currentLevel) {
      const goingDeeper = currentLevel > prevLevelAnimRef.current
      prevLevelAnimRef.current = currentLevel
      // Clear any pending timers
      animTimersRef.current.forEach(clearTimeout)
      animTimersRef.current = []

      // Capture drill-back target NOW before levelPath changes are lost
      let drillBackElementId: string | null = null
      if (!goingDeeper && prevLevelPathRef.current.length > levelPath.length) {
        const popped = prevLevelPathRef.current[prevLevelPathRef.current.length - 1]
        drillBackElementId = popped?.sourceElementId ?? null
      }
      prevLevelPathRef.current = levelPath
      animContextRef.current = { goingDeeper, drillBackElementId }

      // Phase 1: zoom OLD content (renderLevel still shows old level)
      setCanvasTransition('transform 0.28s cubic-bezier(0.4, 0, 0.8, 1), opacity 0.28s cubic-bezier(0.4, 0, 0.8, 1)')
      setCanvasScale(goingDeeper ? 1.35 : 0.7)
      setCanvasOpacity(0)

      // Phase 2: swap content, temporarily remove scale so fitView measures correctly
      const t1 = setTimeout(() => {
        setCanvasTransition('none')
        setCanvasScale(1)
        setCanvasOpacity(0)
        setRenderLevel(currentLevel)
      }, 300)
      animTimersRef.current.push(t1)
    } else {
      prevLevelPathRef.current = levelPath
    }
  }, [currentLevel, levelPath])

  // Fit view to the specific target screen/element when rendered level changes
  const prevRenderLevelRef = useRef(renderLevel)
  useEffect(() => {
    if (readOnly || presentationMode) return
    if (prevRenderLevelRef.current !== renderLevel) {
      prevRenderLevelRef.current = renderLevel
      const ctx = animContextRef.current
      const goingDeeper = ctx?.goingDeeper ?? true

      setTimeout(() => {
        let fitted = false

        if (goingDeeper) {
          // Drilling DOWN — focus on the target screen from levelPath
          const lastEntry = levelPath[levelPath.length - 1]
          if (lastEntry?.screenId) {
            rf.fitView({ nodes: [{ id: lastEntry.screenId }], duration: 0, padding: 0.3 })
            fitted = true
          }
        } else {
          // Drilling UP — focus on the screen containing the source element
          const sourceElId = ctx?.drillBackElementId ?? null
          if (sourceElId) {
            const sourceEl = levelNodes.find((n) => n.id === sourceElId)
            if (sourceEl) {
              const cx = sourceEl.position.x + (sourceEl.width ?? 120) / 2
              const cy = sourceEl.position.y + (sourceEl.height ?? 50) / 2
              const parentScreen = levelNodes.find((n) => {
                if (n.type !== 'screen') return false
                const sx = n.position.x, sy = n.position.y
                const sw = n.width ?? 534, sh = n.height ?? 300
                return cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh
              })
              if (parentScreen) {
                rf.fitView({ nodes: [{ id: parentScreen.id }], duration: 0, padding: 0.1 })
                fitted = true
              }
            }
          }
        }

        // Fallback: fit all screens at this level
        if (!fitted) {
          const lvlScreens = levelNodes.filter((n) => n.type === 'screen')
          if (lvlScreens.length > 0) {
            rf.fitView({ nodes: lvlScreens.map((n) => ({ id: n.id })), duration: 0, padding: 0.15 })
          }
        }

        // After fitView, start phase 3 zoom-in animation
        if (ctx) {
          animContextRef.current = null
          requestAnimationFrame(() => {
            setCanvasScale(goingDeeper ? 0.55 : 1.45)
            setCanvasOpacity(0)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setCanvasTransition('transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease-out')
                setCanvasScale(1)
                setCanvasOpacity(1)
              })
            })
          })
        }
      }, 50)
    }
  }, [renderLevel, levelNodes, levelPath, readOnly, presentationMode, rf])

  // Load share_id on mount (skip on public/readOnly pages)
  useEffect(() => {
    if (!activeChartId || readOnly || presentationMode) return
    import('../../api/client').then(({ flowchartsApi }) => {
      flowchartsApi.get(activeChartId).then((res) => {
        setShareId(res.data.share_id ?? null)
      }).catch(() => {})
    })
  }, [activeChartId, readOnly, presentationMode])

  const handleToggleShare = async () => {
    if (!activeChartId) return
    setShareLoading(true)
    try {
      const { flowchartsApi } = await import('../../api/client')
      const res = await flowchartsApi.toggleShare(activeChartId)
      setShareId(res.data.share_id)
      if (res.data.share_id) {
        const url = `${window.location.origin}/view/${res.data.share_id}/preview`
        await navigator.clipboard.writeText(url)
        const { default: toast } = await import('react-hot-toast')
        toast.success('Share link copied!')
      }
    } catch { /* handled by interceptor */ }
    setShareLoading(false)
  }

  const handleCopyShareLink = async () => {
    if (!shareId) return
    const url = `${window.location.origin}/view/${shareId}/preview`
    await navigator.clipboard.writeText(url)
    const { default: toast } = await import('react-hot-toast')
    toast.success('Share link copied!')
  }

  const screenCount  = useMemo(() => nodes.filter((n) => n.type === 'screen').length,  [nodes])
  const elementCount = useMemo(() => nodes.filter((n) => n.type === 'element').length, [nodes])

  // Clipboard — use refs so the keydown listener always sees current values
  const clipboardRef = useRef<{ nodes: FlowNode[]; edges: FlowEdge[] }>({ nodes: [], edges: [] })
  const nodesRef     = useRef(nodes)
  const edgesRef     = useRef(edges)
  nodesRef.current   = nodes
  edgesRef.current   = edges

  // Track Ctrl/Cmd held state for selection-box mode
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) setCtrlDown(true) }
    const onUp   = (e: KeyboardEvent) => { if (!e.ctrlKey && !e.metaKey) setCtrlDown(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey

      // Don't intercept inside text inputs / textareas
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (meta && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) redo()
        else undo()
        e.preventDefault()
        return
      }
      if (meta && (e.key === 'y' || e.key === 'Y')) {
        redo()
        e.preventDefault()
        return
      }

      if (!meta) return

      if (e.key === 'c') {
        const selected = nodesRef.current.filter((n) => n.selected && n.type === 'element')
        if (!selected.length) return
        const ids = new Set(selected.map((n) => n.id))
        clipboardRef.current = {
          nodes: selected,
          edges: edgesRef.current.filter((e) => ids.has(e.source) && ids.has(e.target)),
        }
        e.preventDefault()
      }

      if (e.key === 'v') {
        if (!clipboardRef.current.nodes.length) return
        pasteElements(clipboardRef.current.nodes, clipboardRef.current.edges)
        e.preventDefault()
      }

      if (e.key === 'd') {
        // Duplicate: copy + paste in one shot
        const selected = nodesRef.current.filter((n) => n.selected && n.type === 'element')
        if (!selected.length) return
        const ids = new Set(selected.map((n) => n.id))
        pasteElements(
          selected,
          edgesRef.current.filter((e) => ids.has(e.source) && ids.has(e.target)),
        )
        e.preventDefault()
      }

      if (e.key === 's') {
        e.preventDefault()
        handleSaveRef.current()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteElements, undo, redo])

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Shift/Ctrl clicks are handled natively by ReactFlow (multiSelectionKeyCode).
      // Only update our panel selection on plain clicks.
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) selectNode(node.id)
    },
    [selectNode],
  )

  // ── Shift+drag: axis-lock  |  Alt+drag: duplicate ────────────────────────────
  // axisDragRef holds the pending axis; once determined it's committed to _axisLock
  const axisDragRef = useRef<{
    startPositions: Record<string, { x: number; y: number }>
    leadId: string
    axis: 'h' | 'v' | null
  } | null>(null)
  // Alt+drag: handled entirely in dragStart (clone stays, original is dragged as new copy)

  const handleNodeDragStart = useCallback(
    (e: React.MouseEvent, node: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      pushHistory()
      setAxisLock(null)  // clear any stale lock

      if (e.altKey && node.type === 'element') {
        axisDragRef.current = null

        // Everything happens at drag START so the original never visually moves:
        // 1. Create clone at same position (becomes the "stay-behind original")
        // 2. Transfer edges original→clone (clone keeps all connections)
        // 3. Bump original's step (original = the node React Flow is dragging = "new copy")
        const s = useFlowchartStore.getState()
        const chartId = s.activeChartId
        if (!chartId) return
        const chart = s.charts[chartId]
        if (!chart) return
        const origNode = chart.nodes.find((n) => n.id === node.id)
        if (!origNode) return

        const maxStep = Math.max(
          0,
          ...chart.nodes.filter((n) => n.type === 'element')
            .map((n) => (n.data as any).step ?? 0), // eslint-disable-line @typescript-eslint/no-explicit-any
        )

        // Create clone at same array position (preserves layer order / z-index),
        // transfer edges original→clone, bump original's step.
        const cloneId = `element-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const origIdx = chart.nodes.findIndex((n) => n.id === node.id)

        useFlowchartStore.setState((st) => {
          const c = st.charts[chartId]!
          // Clone node: same position, same step, same data, not selected
          const clone = { ...origNode, id: cloneId, selected: false }
          // Insert clone right before the original so it sits at the same layer
          const newNodes = [...c.nodes]
          if (origIdx !== -1) newNodes.splice(origIdx, 0, clone)
          else newNodes.push(clone)

          return {
            charts: {
              ...st.charts,
              [chartId]: {
                ...c,
                nodes: newNodes.map((n) =>
                  n.id === node.id
                    ? { ...n, data: { ...n.data, step: maxStep + 1 } }
                    : n
                ),
                edges: c.edges.map((ed) => {
                  const src = ed.source === node.id ? cloneId : ed.source
                  const tgt = ed.target === node.id ? cloneId : ed.target
                  return (src !== ed.source || tgt !== ed.target)
                    ? { ...ed, source: src, target: tgt }
                    : ed
                }),
              },
            },
          }
        })
        return
      }

      if (e.shiftKey) {
        const startPositions: Record<string, { x: number; y: number }> = {}
        rf.getNodes().forEach((n) => {
          if (n.selected || n.id === node.id) startPositions[n.id] = { x: n.position.x, y: n.position.y }
        })
        axisDragRef.current = { startPositions, leadId: node.id, axis: null }
      } else {
        axisDragRef.current = null
      }
    },
    [pushHistory, pasteElements, updateNode, rf], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── Snap guides — show proximity lines during drag ───────────────────────────
  const computeSnap = useCallback(
    (node: any, allNodes: any[], selectedIds: Set<string>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const { zoom } = rf.getViewport()
      const THRESHOLD = 10 / zoom          // 10 screen-px → flow units
      const nw = node.width  ?? 120
      const nh = node.height ?? 50
      const nx = node.position.x
      const ny = node.position.y
      const ncx = nx + nw / 2
      const ncy = ny + nh / 2

      let snapX: number | undefined
      let snapY: number | undefined
      const vFlow: number[] = []   // flow-coord guide verticals (X)
      const hFlow: number[] = []   // flow-coord guide horizontals (Y)

      for (const n of allNodes) {
        if (selectedIds.has(n.id)) continue  // skip all selected nodes, not just the lead
        const bw = n.width  ?? (n.type === 'screen' ? 534 : 120)
        const bh = n.height ?? (n.type === 'screen' ? 300 :  50)
        const bx = n.position.x, by = n.position.y
        const bcx = bx + bw / 2,  bcy = by + bh / 2

        // Center-to-center
        if (snapX === undefined && Math.abs(ncx - bcx) < THRESHOLD) { snapX = bcx - nw / 2; vFlow.push(bcx) }
        if (snapY === undefined && Math.abs(ncy - bcy) < THRESHOLD) { snapY = bcy - nh / 2; hFlow.push(bcy) }

        // Left edge
        if (snapX === undefined && Math.abs(nx - bx)  < THRESHOLD) { snapX = bx;           vFlow.push(bx)  }
        // Right edge
        if (snapX === undefined && Math.abs(nx + nw - (bx + bw)) < THRESHOLD) { snapX = bx + bw - nw; vFlow.push(bx + bw) }
        // Left-to-right & right-to-left (gap snap)
        if (snapX === undefined && Math.abs(nx - (bx + bw)) < THRESHOLD) { snapX = bx + bw; vFlow.push(bx + bw) }
        if (snapX === undefined && Math.abs(nx + nw - bx)   < THRESHOLD) { snapX = bx - nw; vFlow.push(bx)  }

        // Top edge
        if (snapY === undefined && Math.abs(ny - by)  < THRESHOLD) { snapY = by;           hFlow.push(by)  }
        // Bottom edge
        if (snapY === undefined && Math.abs(ny + nh - (by + bh)) < THRESHOLD) { snapY = by + bh - nh; hFlow.push(by + bh) }
        // Top-to-bottom & bottom-to-top
        if (snapY === undefined && Math.abs(ny - (by + bh)) < THRESHOLD) { snapY = by + bh; hFlow.push(by + bh) }
        if (snapY === undefined && Math.abs(ny + nh - by)   < THRESHOLD) { snapY = by - nh; hFlow.push(by)  }
      }

      return { snapX, snapY, vFlow, hFlow }
    },
    [rf],
  )

  const handleNodeDrag = useCallback(
    (_e: React.MouseEvent, node: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // ── Shift axis lock — determine axis then activate lock via store ─────────
      if (axisDragRef.current) {
        const ref = axisDragRef.current
        const leadStart = ref.startPositions[ref.leadId]
        if (leadStart && ref.axis === null) {
          const dx = node.position.x - leadStart.x
          const dy = node.position.y - leadStart.y
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            ref.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
            // Commit the lock — onNodesChange will enforce it from here on
            setAxisLock({ axis: ref.axis, startPositions: ref.startPositions })
          }
        }
      }

      if (!snapEnabled || node.type !== 'element') { setSnapGuides({ vx: [], hy: [] }); return }
      const allNodes = rf.getNodes()
      const selectedIds = new Set(allNodes.filter((n) => n.selected).map((n) => n.id))
      const { snapX, snapY, vFlow, hFlow } = computeSnap(node, allNodes, selectedIds)
      if (!vFlow.length && !hFlow.length) { setSnapGuides({ vx: [], hy: [] }); return }

      // Convert flow coords → canvas-relative screen coords for rendering
      const { zoom, x: vpx, y: vpy } = rf.getViewport()
      setSnapGuides({
        vx: vFlow.map((fx) => fx * zoom + vpx),
        hy: hFlow.map((fy) => fy * zoom + vpy),
      })

      // If snapping, override node position so it locks to the guide
      if (snapX !== undefined || snapY !== undefined) {
        const nx = node.position.x, ny = node.position.y
        const dx = (snapX ?? nx) - nx
        const dy = (snapY ?? ny) - ny
        if (dx !== 0 || dy !== 0) {
          rf.setNodes((nds) => nds.map((n) =>
            n.selected ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n,
          ))
        }
      }
    },
    [snapEnabled, computeSnap, rf],
  )

  const handleNodeDragStop = useCallback(
    (_e: React.MouseEvent, node: any, draggedNodes: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      axisDragRef.current = null
      setAxisLock(null)   // release axis constraint
      setSnapGuides({ vx: [], hy: [] })
      // Alt+drag is fully handled in dragStart — nothing to do here.
      if (!snapEnabled || node.type !== 'element') return
      const allNodes = rf.getNodes()
      const selectedIds = new Set(allNodes.filter((n) => n.selected).map((n) => n.id))
      const { snapX, snapY } = computeSnap(node, allNodes, selectedIds)
      if (snapX === undefined && snapY === undefined) return
      const nx = node.position.x, ny = node.position.y
      const dx = (snapX ?? nx) - nx
      const dy = (snapY ?? ny) - ny
      if (dx === 0 && dy === 0) return
      // Move all dragged nodes by the same delta to preserve relative positions
      const ids = new Set(draggedNodes.map((n: any) => n.id)) // eslint-disable-line @typescript-eslint/no-explicit-any
      rf.setNodes((nds) => nds.map((n) =>
        ids.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n,
      ))
    },
    [snapEnabled, computeSnap, rf, pasteElements],
  )
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: any) => selectEdge(edge.id), // eslint-disable-line @typescript-eslint/no-explicit-any
    [selectEdge],
  )
  const handlePaneClick = useCallback(() => {
    selectNode(null)
    selectEdge(null)
  }, [selectNode, selectEdge])

  async function handleSave() {
    if (!activeChartId || readOnly) return
    setSaving(true)
    try {
      await saveChart(activeChartId)
      setSavedAt(new Date().toLocaleTimeString())
      setTimeout(() => setSavedAt(null), 2500)
    } finally {
      setSaving(false)
    }
  }

  // Auto-save every 30 seconds when enabled
  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave
  useEffect(() => {
    if (!autoSave || readOnly) return
    const id = setInterval(() => handleSaveRef.current(), 30_000)
    return () => clearInterval(id)
  }, [autoSave, readOnly])

  const bgVariant = BG_VARIANT[bgTexture]

  // In presentation mode, strip selection state and disable dragging.
  // Set screen nodes to zIndex -1 so they sit below the React Flow edge SVG layer (z-index 0),
  // making edges visible above screen backgrounds.
  const presentationNodes = presentationMode
    ? nodes.map((n) => ({
        ...n,
        selected: false,
        draggable: false,
        zIndex: n.type === 'screen' ? -1 : Math.max(1, (n.zIndex as number | undefined) ?? 1),
      }))
    : nodes

  // ── Presentation mode render ─────────────────────────────────────────────────
  if (presentationMode) {
    return (
      <PresentationContext.Provider value={{ presentationMode: true, nodeStates: presentationNodeStates ?? {} }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <ReactFlow
            nodes={presentationNodes}
            edges={[]}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'animatedEdge' }}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            defaultViewport={presentationInitialViewport ?? { x: 0, y: 0, zoom: 1 }}
            style={{ background: 'transparent' }}
            proOptions={{ hideAttribution: true }}
          >
            {onRfReady && <RfCapture onReady={onRfReady} />}
          </ReactFlow>
        </div>
      </PresentationContext.Provider>
    )
  }

  // ── Read-only mode: zoom/pan enabled, no editing ─────────────────────────────
  if (readOnly) {
    return <ReadOnlyCanvas allNodes={allNodes} allEdges={allEdges} bgVariant={bgVariant} topOffset={readOnlyTopOffset} />
  }

  return (
    <PresentationContext.Provider value={{ presentationMode: false, nodeStates: {}, showSteps: stepBadges, showDebug }}>
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#f8fafc' }}>

      {/* ── Top bar ── */}
      <div style={{
        position:       'absolute',
        top:            0, left: 0, right: 0,
        height:         48,
        background:     '#ffffff',
        borderBottom:   '1px solid #e2e8f0',
        zIndex:         20,
        display:        'flex',
        alignItems:     'center',
        padding:        '0 16px',
        gap:            12,
        justifyContent: 'space-between',
        boxShadow:      '0 1px 4px #0000000a',
      }}>
        {/* Left: title + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1' }} />
          <span style={{ color: '#1e293b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
            FLOWCHART
          </span>
          <span style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}>
            {screenCount} screen{screenCount !== 1 ? 's' : ''} · {elementCount} element{elementCount !== 1 ? 's' : ''} · {edges.length} edge{edges.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Center: background texture selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>BG:</span>
          {BG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setBgTexture(opt.value)}
              style={{
                padding:      '3px 8px',
                background:    bgTexture === opt.value ? '#6366f1' : '#f8fafc',
                border:       `1px solid ${bgTexture === opt.value ? '#6366f1' : '#e2e8f0'}`,
                borderRadius:  4,
                color:         bgTexture === opt.value ? '#fff' : '#64748b',
                cursor:        'pointer',
                fontFamily:   'IBM Plex Mono, monospace',
                fontSize:      10,
                transition:   'all .12s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedAt && (
            <span style={{ fontSize: 10, color: '#22c55e', fontFamily: 'IBM Plex Mono, monospace' }}>
              Saved {savedAt}
            </span>
          )}
          <TopBtn onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</TopBtn>
          {shareId ? (
            <>
              <TopBtn onClick={handleCopyShareLink}>Copy Link</TopBtn>
              <TopBtn onClick={handleToggleShare} danger>{shareLoading ? '…' : 'Unshare'}</TopBtn>
            </>
          ) : (
            <TopBtn onClick={handleToggleShare}>{shareLoading ? '…' : 'Share'}</TopBtn>
          )}
          <TopBtn onClick={() => setShowSteps(true)}>Steps</TopBtn>
          <TopBtn onClick={() => setShowCanvasView(true)}>Canvas</TopBtn>
          <TopBtn onClick={() => setShowPlayer(true)} primary>Preview</TopBtn>
          <TopBtn onClick={() => navigate('/dashboard')} danger>Exit</TopBtn>
        </div>
      </div>

      {/* ── Level breadcrumb bar ── */}
      {currentLevel > 1 && (
        <div style={{
          position: 'absolute', top: 48, left: 0, right: 0, height: 32, zIndex: 20,
          background: '#f0f0ff', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6,
        }}>
          <button
            onClick={drillUp}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
              background: 'none', border: '1px solid #c7d2fe', borderRadius: 4,
              cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10,
              color: '#6366f1', fontWeight: 600,
            }}
          >
            &larr; Back
          </button>
          <button
            onClick={() => navigateToLevel(-1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#6366f1',
              fontWeight: 600, padding: '2px 4px',
            }}
          >
            Level 1
          </button>
          {levelPath.map((entry, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#94a3b8', fontSize: 10 }}>&rsaquo;</span>
              <button
                onClick={() => navigateToLevel(i)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 10,
                  color: i === levelPath.length - 1 ? '#1e293b' : '#6366f1',
                  fontWeight: i === levelPath.length - 1 ? 700 : 500,
                  padding: '2px 4px',
                }}
              >
                L{entry.level}: {entry.label}
              </button>
            </span>
          ))}
          <span style={{
            marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Depth {currentLevel}
          </span>
        </div>
      )}

      {/* ── React Flow canvas ── */}
      <div style={{
        position: 'absolute', top: currentLevel > 1 ? 80 : 48, left: 62, right: 230, bottom: 0,
        transition: 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Level timeline — outside animated wrapper so it doesn't zoom */}
        <LevelSwitcher allNodes={allNodes} currentLevel={currentLevel} jumpToLevel={jumpToLevel} />
        {/* Animated canvas wrapper */}
        <div style={{
          width: '100%', height: '100%', position: 'relative',
          transform: `scale(${canvasScale})`,
          opacity: canvasOpacity,
          transition: canvasTransition,
          transformOrigin: 'center center',
          willChange: 'transform, opacity',
        }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag={ctrlDown}
          selectionKeyCode={null}
          multiSelectionKeyCode="Shift"
          panOnDrag={ctrlDown ? [1, 2] : [0, 1, 2]}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.05}
          maxZoom={4}
          defaultEdgeOptions={{ type: 'animatedEdge' }}
          style={{ background: '#f8fafc' }}
          proOptions={{ hideAttribution: true }}
        >
          {bgVariant && <Background color="#e2e8f0" gap={20} size={1} variant={bgVariant} />}
          <Controls style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 2px 8px #00000008' }} />
          <MiniMap
            style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }}
            nodeColor={(n) => n.type === 'screen' ? '#6366f122' : '#6366f144'}
            maskColor="#f8fafc99"
          />
        </ReactFlow>

        {/* ── Snap guide lines overlay ── */}
        {snapEnabled && snapGuides.vx.map((x, i) => (
          <div key={`sv${i}`} style={{
            position: 'absolute', top: 0, bottom: 0, left: x,
            width: 1, background: '#6366f1', opacity: 0.55,
            pointerEvents: 'none', zIndex: 30,
          }} />
        ))}
        {snapEnabled && snapGuides.hy.map((y, i) => (
          <div key={`sh${i}`} style={{
            position: 'absolute', left: 0, right: 0, top: y,
            height: 1, background: '#6366f1', opacity: 0.55,
            pointerEvents: 'none', zIndex: 30,
          }} />
        ))}
        </div>{/* end animated canvas wrapper */}
      </div>

      {/* ── Left toolbar ── */}
      <div style={{ position: 'absolute', top: currentLevel > 1 ? 80 : 48, left: 0, width: 62, bottom: 0, zIndex: 20, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'all', position: 'relative', height: '100%' }}>
          <Toolbar />
        </div>
      </div>

      {/* ── Right config panel ── */}
      <div style={{
        position:      'absolute',
        top:           currentLevel > 1 ? 80 : 48,
        right:         0,
        width:         230,
        bottom:        0,
        background:    '#ffffff',
        borderLeft:    '1px solid #e2e8f0',
        zIndex:        20,
        display:       'flex',
        flexDirection: 'column',
        boxShadow:     '-2px 0 8px #0000000a',
      }}>
        <div style={{
          padding:      '9px 14px',
          borderBottom: '1px solid #f1f5f9',
          fontSize:      9,
          color:         '#6366f1',
          fontFamily:   'IBM Plex Mono, monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight:    700,
          flexShrink:    0,
          background:    '#fafafa',
        }}>
          Configure
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ConfigPanel global={{
            snapEnabled, setSnapEnabled: (v: boolean) => setSnapEnabled(v),
            stepBadges, setStepBadges: (v: boolean) => setStepBadges(v),
            autoSave, setAutoSave: (v: boolean) => setAutoSave(v),
            showDebug, setShowDebug: (v: boolean) => setShowDebug(v),
            onGenerate: () => setShowAIModal(true),
          }} />
        </div>
      </div>

      {/* React Flow control overrides */}
      <style>{`
        .react-flow__controls { left: 8px !important; bottom: 16px !important; }
        .react-flow__minimap  { right: 8px !important; bottom: 16px !important; }
        .react-flow__controls button { background: #fff !important; border: 1px solid #e2e8f0 !important; fill: #64748b !important; }
        .react-flow__controls button:hover { background: #f8fafc !important; }
        .react-flow__handle { transition: opacity .12s; }
        .react-flow__node:hover .fc-handle { opacity: 1 !important; }

      `}</style>

      {showPlayer   && <AnimationPlayer onClose={() => setShowPlayer(false)} />}
      {showCanvasView && <CanvasViewOverlay onClose={() => setShowCanvasView(false)} />}
      {showSteps    && <StepViewer     onClose={() => setShowSteps(false)}  />}
      {showAIModal  && <AIGenerateModal onClose={() => setShowAIModal(false)} />}
    </div>
    </PresentationContext.Provider>
  )
}
