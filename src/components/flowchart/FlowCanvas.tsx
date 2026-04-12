import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useFlowchartStore, selectNodes, selectEdges, setAxisLock } from '../../store/useFlowchartStore'
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

// ── Main canvas ───────────────────────────────────────────────────────────────

interface FlowCanvasProps {
  presentationMode?: boolean
  readOnly?: boolean
  presentationNodeStates?: Record<string, NodeAnimState>
  onRfReady?: (rf: ReactFlowInstance) => void
  presentationInitialViewport?: { x: number; y: number; zoom: number }
}

export default function FlowCanvas({ presentationMode = false, readOnly = false, presentationNodeStates, onRfReady, presentationInitialViewport }: FlowCanvasProps) {
  const nodes = useFlowchartStore(selectNodes)
  const edges = useFlowchartStore(selectEdges)
  const { onNodesChange, onEdgesChange, onConnect, selectNode, selectEdge, saveChart, activeChartId, pasteElements, updateNode, pushHistory, undo, redo } = useFlowchartStore()

  const rf = useReactFlow()
  const navigate = useNavigate()
  const [showPlayer,   setShowPlayer]   = useState(false)
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
        const url = `${window.location.origin}/view/${res.data.share_id}`
        await navigator.clipboard.writeText(url)
        const { default: toast } = await import('react-hot-toast')
        toast.success('Share link copied!')
      }
    } catch { /* handled by interceptor */ }
    setShareLoading(false)
  }

  const handleCopyShareLink = async () => {
    if (!shareId) return
    const url = `${window.location.origin}/view/${shareId}`
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
    const roNodes = nodes.map((n) => ({
      ...n,
      selected: false,
      draggable: false,
      zIndex: n.type === 'screen' ? -1 : Math.max(1, (n.zIndex as number | undefined) ?? 1),
    }))

    // Focus on the first screen (by order/step) with some zoom-out
    const firstScreen = nodes
      .filter((n) => n.type === 'screen')
      .sort((a, b) => ((a.data as ScreenData).order ?? 0) - ((b.data as ScreenData).order ?? 0))[0]

    const fitViewOpts = firstScreen
      ? { padding: 0.8, includeHiddenNodes: false, nodes: [{ id: firstScreen.id }] }
      : { padding: 0.8 }

    return (
      <PresentationContext.Provider value={{ presentationMode: false, nodeStates: {}, showSteps: false, showDebug: false }}>
        <div style={{ position: 'absolute', inset: 0, background: '#f8fafc' }}>
          <ReactFlow
            nodes={roNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'animatedEdge' }}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            elementsSelectable={false}
            connectionMode={ConnectionMode.Loose}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
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
          <TopBtn onClick={() => setShowPlayer(true)} primary>Preview</TopBtn>
          <TopBtn onClick={() => navigate('/dashboard')} danger>Exit</TopBtn>
        </div>
      </div>

      {/* ── React Flow canvas ── */}
      <div style={{ position: 'absolute', top: 48, left: 62, right: 230, bottom: 0 }}>
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
      </div>

      {/* ── Left toolbar ── */}
      <div style={{ position: 'absolute', top: 48, left: 0, width: 62, bottom: 0, zIndex: 20, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'all', position: 'relative', height: '100%' }}>
          <Toolbar />
        </div>
      </div>

      {/* ── Right config panel ── */}
      <div style={{
        position:      'absolute',
        top:           48,
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
      {showSteps    && <StepViewer     onClose={() => setShowSteps(false)}  />}
      {showAIModal  && <AIGenerateModal onClose={() => setShowAIModal(false)} />}
    </div>
    </PresentationContext.Provider>
  )
}
