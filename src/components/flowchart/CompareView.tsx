import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  type Viewport,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodesForLevel, edgesForNodes } from '../../store/useFlowchartStore'
import type { FlowNode, FlowEdge } from '../../store/useFlowchartStore'
import type { ScreenData } from '../../types/flowchart'
import { ScreenNode } from './nodes/ScreenNode'
import { ElementNode } from './nodes/ElementNode'
import { AnimatedEdge } from './edges/AnimatedEdge'
import { PresentationContext } from './PresentationContext'

const nodeTypes = {
  screen: ScreenNode as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  element: ElementNode as any, // eslint-disable-line @typescript-eslint/no-explicit-any
}
const edgeTypes = {
  animatedEdge: AnimatedEdge as any, // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ── Shared sync controller (no React state — pure imperative) ───────────────

interface SyncController {
  peerRf: ReactFlowInstance | null
  active: 'left' | 'right' | null
  enabled: boolean
}

// ── Single pane ─────────────────────────────────────────────────────────────

interface PaneProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  label: string
  isParallel?: boolean
  side: 'left' | 'right'
  ctrl: React.MutableRefObject<SyncController>
  onSyncScreen?: (screenId: string) => void
  onSyncAll?: () => void
  onEditParallel?: () => void
  onDeleteParallel?: () => void
  syncingScreenId?: string | null
  syncingAll?: boolean
}

function PaneInner({
  nodes: allNodes,
  edges: allEdges,
  label,
  isParallel,
  side,
  ctrl,
  onSyncScreen,
  onSyncAll,
  onEditParallel,
  onDeleteParallel,
  syncingScreenId,
  syncingAll,
}: PaneProps) {
  const rf = useReactFlow()
  const [viewLevel, setViewLevel] = useState(1)
  const suppressRef = useRef(false)

  // Register this pane's RF instance so the peer can drive it
  useEffect(() => {
    ctrl.current.peerRf = null // reset
    // Slight hack: we need to tell the parent about our RF.
    // We store it in a slot based on side.
    ;(ctrl.current as any)[side + 'Rf'] = rf // eslint-disable-line @typescript-eslint/no-explicit-any
    return () => { (ctrl.current as any)[side + 'Rf'] = null } // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [rf, side, ctrl])

  const levelNodes = useMemo(() => nodesForLevel(allNodes, viewLevel), [allNodes, viewLevel])
  const levelNodeIds = useMemo(() => new Set(levelNodes.map((n) => n.id)), [levelNodes])
  const levelEdges = useMemo(() => edgesForNodes(allEdges, levelNodeIds), [allEdges, levelNodeIds])
  const roNodes = levelNodes.map((n) => ({
    ...n, selected: false, draggable: false,
    zIndex: n.type === 'screen' ? -1 : Math.max(1, (n.zIndex as number | undefined) ?? 1),
  }))

  const handleMoveStart = useCallback(() => {
    ctrl.current.active = side
  }, [side, ctrl])

  const handleMove = useCallback((_: any, vp: Viewport) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (suppressRef.current) return
    if (!ctrl.current.enabled) return
    if (ctrl.current.active !== side) return
    // Directly drive the peer's viewport — no React state
    const peerSide = side === 'left' ? 'right' : 'left'
    const peerRf = (ctrl.current as any)[peerSide + 'Rf'] as ReactFlowInstance | null // eslint-disable-line @typescript-eslint/no-explicit-any
    if (peerRf) {
      peerRf.setViewport(vp, { duration: 0 })
    }
  }, [side, ctrl])

  const handleMoveEnd = useCallback(() => {
    if (ctrl.current.active === side) ctrl.current.active = null
  }, [side, ctrl])

  // Drill-down
  useEffect(() => {
    const handler = (e: CustomEvent<{ elementId: string }>) => {
      const el = allNodes.find((n) => n.id === e.detail.elementId)
      if (!el) return
      const expId = (el.data as any).expandedScreenId // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!expId) return
      const scr = allNodes.find((n) => n.id === expId)
      if (!scr) return
      setViewLevel((scr.data as ScreenData).level ?? 1)
    }
    window.addEventListener('fc-drill-down' as any, handler as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    return () => window.removeEventListener('fc-drill-down' as any, handler as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [allNodes])

  const levelScreens = useMemo(
    () => levelNodes.filter((n) => n.type === 'screen')
      .sort((a, b) => ((a.data as ScreenData).order ?? 0) - ((b.data as ScreenData).order ?? 0)),
    [levelNodes],
  )
  const firstScreen = levelScreens[0]
  const fitViewOpts = firstScreen
    ? { padding: 0.8, includeHiddenNodes: false, nodes: [{ id: firstScreen.id }] }
    : { padding: 0.8 }

  return (
    <PresentationContext.Provider value={{ presentationMode: false, nodeStates: {}, showSteps: false, showDebug: false }}>
      <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          height: 32, flexShrink: 0,
          background: isParallel ? '#fef3c7' : '#ede9fe',
          borderBottom: '1px solid ' + (isParallel ? '#fcd34d' : '#c4b5fd'),
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: isParallel ? '#f59e0b' : '#6366f1' }} />
            <span style={{
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700,
              color: isParallel ? '#92400e' : '#4338ca', letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {isParallel && onEditParallel && (
              <button onClick={onEditParallel} style={{
                padding: '2px 8px', background: '#6366f1', border: 'none', borderRadius: 3,
                cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 8,
                color: '#fff', fontWeight: 700,
              }}>Edit</button>
            )}
            {isParallel && onDeleteParallel && (
              <button onClick={onDeleteParallel} style={{
                padding: '2px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 3,
                cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 8,
                color: '#ef4444', fontWeight: 600,
              }}>Delete</button>
            )}
            {isParallel && onSyncAll && (
              <button onClick={onSyncAll} disabled={syncingAll} style={{
                padding: '2px 8px', background: syncingAll ? '#fef9c3' : '#fff',
                border: '1px solid #fcd34d', borderRadius: 3,
                cursor: syncingAll ? 'wait' : 'pointer', fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 8, color: '#92400e', fontWeight: 600,
              }}>{syncingAll ? 'Syncing...' : 'Sync New Screens'}</button>
            )}
          </div>
        </div>

        {/* Per-screen sync buttons */}
        {isParallel && onSyncScreen && (
          <div style={{
            position: 'absolute', top: 40, right: 6, zIndex: 10,
            display: 'flex', flexDirection: 'column', gap: 3,
            maxHeight: 'calc(100% - 48px)', overflowY: 'auto',
          }}>
            {levelScreens.map((scr) => (
              <button key={scr.id} onClick={() => onSyncScreen(scr.id)}
                disabled={syncingScreenId === scr.id}
                style={{
                  padding: '2px 6px',
                  background: syncingScreenId === scr.id ? '#fef9c3' : 'rgba(255,255,255,0.92)',
                  border: '1px solid #e2e8f0', borderRadius: 3,
                  cursor: syncingScreenId === scr.id ? 'wait' : 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, color: '#475569', fontWeight: 500,
                  backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: 3,
                }}
                title={`Sync "${(scr.data as ScreenData).label}" from original`}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                  <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                {(scr.data as ScreenData).label}
              </button>
            ))}
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={roNodes} edges={levelEdges}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'animatedEdge' }}
            nodesDraggable={false} nodesConnectable={false} nodesFocusable={false}
            elementsSelectable={false} connectionMode={ConnectionMode.Loose}
            panOnDrag panOnScroll zoomOnScroll zoomOnPinch
            zoomOnDoubleClick={false}
            fitView fitViewOptions={fitViewOpts}
            onMoveStart={handleMoveStart}
            onMove={handleMove}
            onMoveEnd={handleMoveEnd}
            style={{ background: '#f8fafc' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </PresentationContext.Provider>
  )
}

function Pane(props: PaneProps) {
  return <ReactFlowProvider><PaneInner {...props} /></ReactFlowProvider>
}

// ── CompareView ─────────────────────────────────────────────────────────────

interface CompareViewProps {
  onClose: () => void
  originalNodes: FlowNode[]
  originalEdges: FlowEdge[]
  originalName: string
  parallelNodes: FlowNode[]
  parallelEdges: FlowEdge[]
  parallelName: string
  onSyncScreen?: (screenId: string) => Promise<void>
  onSyncAll?: () => Promise<void>
  onEditParallel?: () => void
  onDeleteParallel?: () => void
  embedded?: boolean
  topOffset?: number
}

export default function CompareView({
  onClose,
  originalNodes, originalEdges, originalName,
  parallelNodes, parallelEdges, parallelName,
  onSyncScreen, onSyncAll, onEditParallel, onDeleteParallel,
  embedded, topOffset = 0,
}: CompareViewProps) {
  const ctrlRef = useRef<SyncController>({ peerRf: null, active: null, enabled: true })
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [syncingScreenId, setSyncingScreenId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  // Keep ctrl in sync with React state
  useEffect(() => { ctrlRef.current.enabled = syncEnabled }, [syncEnabled])

  const handleSyncScreen = useCallback(async (screenId: string) => {
    if (!onSyncScreen) return
    setSyncingScreenId(screenId)
    try { await onSyncScreen(screenId) } finally { setSyncingScreenId(null) }
  }, [onSyncScreen])

  const handleSyncAll = useCallback(async () => {
    if (!onSyncAll) return
    setSyncingAll(true)
    try { await onSyncAll() } finally { setSyncingAll(false) }
  }, [onSyncAll])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{
      position: embedded ? 'absolute' : 'fixed', inset: 0, top: topOffset,
      zIndex: embedded ? 1 : 100, background: '#f1f5f9',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      {!embedded && (
        <div style={{
          height: 40, background: '#fff', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: '#6366f1' }} />
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, color: '#1e293b', letterSpacing: '0.08em' }}>COMPARE</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#94a3b8' }}>{originalName} vs {parallelName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setSyncEnabled(!syncEnabled)} style={{
              padding: '4px 10px',
              background: syncEnabled ? '#6366f1' : '#f8fafc',
              border: `1px solid ${syncEnabled ? '#6366f1' : '#e2e8f0'}`,
              borderRadius: 4, color: syncEnabled ? '#fff' : '#64748b', cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              {syncEnabled ? 'Synced' : 'Independent'}
            </button>
            <button onClick={onClose} style={{
              padding: '4px 10px', background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: 4, color: '#475569', cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 500,
            }}>Close</button>
          </div>
        </div>
      )}

      {/* Embedded floating sync toggle */}
      {embedded && (
        <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <button onClick={() => setSyncEnabled(!syncEnabled)} style={{
            padding: '4px 10px',
            background: syncEnabled ? '#6366f1' : 'rgba(255,255,255,0.95)',
            border: `1px solid ${syncEnabled ? '#6366f1' : '#e2e8f0'}`,
            borderRadius: 4, color: syncEnabled ? '#fff' : '#64748b', cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 600,
            backdropFilter: 'blur(6px)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>{syncEnabled ? 'Pan Synced' : 'Independent'}</button>
        </div>
      )}

      {/* Panes */}
      <div style={{ flex: 1, display: 'flex', gap: 1 }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Pane nodes={originalNodes} edges={originalEdges} label={`Original: ${originalName}`}
            side="left" ctrl={ctrlRef} />
        </div>
        <div style={{ width: 2, background: '#c4b5fd', flexShrink: 0 }} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Pane nodes={parallelNodes} edges={parallelEdges} label={`Parallel: ${parallelName}`}
            isParallel side="right" ctrl={ctrlRef}
            onSyncScreen={onSyncScreen ? handleSyncScreen : undefined}
            onSyncAll={onSyncAll ? handleSyncAll : undefined}
            onEditParallel={onEditParallel}
            onDeleteParallel={onDeleteParallel}
            syncingScreenId={syncingScreenId} syncingAll={syncingAll} />
        </div>
      </div>
    </div>
  )
}
