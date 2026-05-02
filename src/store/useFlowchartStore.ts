import { create } from 'zustand'
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react'
import {
  ScreenData, ElementData, EdgeData, AspectRatio,
  defaultElementStyle, defaultElementAnimation,
  defaultEdgeStyle, defaultEdgeAnimation,
  ASPECT_RATIO_SIZES,
} from '../types/flowchart'

export interface LevelPathEntry {
  level: number
  screenId: string
  label: string
  sourceElementId?: string   // element that was expanded to reach this level
}
import { flowchartsApi } from '../api/client'
import type { AIChartSpec } from '../api/client'

// ── Node types ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScreenNode  = Node<any, 'screen'>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ElementNode = Node<any, 'element'>
export type FlowNode    = ScreenNode | ElementNode
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FlowEdge    = Edge<any>

// ── Multi-chart meta ──────────────────────────────────────────────────────────

export interface FlowchartMeta {
  id:         string
  name:       string
  created_at: string
  updated_at: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface FlowchartStore {
  metas:         FlowchartMeta[]
  charts:        Record<string, { nodes: FlowNode[]; edges: FlowEdge[] }>
  activeChartId: string | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  loading:       boolean

  // Level navigation
  currentLevel:  number
  levelPath:     LevelPathEntry[]

  // Chart management
  loadCharts():                    Promise<void>
  createChart(name: string):       Promise<string>
  deleteChart(id: string):         Promise<void>
  renameChart(id: string, name: string): Promise<void>
  setActiveChart(id: string):      Promise<void>
  saveChart(id: string):           Promise<void>

  // React Flow handlers
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect:     (connection: Connection) => void

  // Node mutations
  addScreen:         (position?: { x: number; y: number }) => string
  addElement:        (opts?: Partial<ElementData>, position?: { x: number; y: number }) => string
  updateNode:        (id: string, data: Partial<ScreenData | ElementData>) => void
  updateNodeSize:    (id: string, width: number, height: number) => void
  resizeAllScreens:  (width: number, height: number) => void
  removeNode:        (id: string) => void
  reorderNode:       (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => void
  setChartRatio:     (ratio: AspectRatio) => void

  // Edge mutations
  updateEdge:  (id: string, data: Partial<EdgeData>) => void
  removeEdge:  (id: string) => void

  // Selection
  selectNode:  (id: string | null) => void
  selectEdge:  (id: string | null) => void

  // Clipboard
  pasteElements: (srcNodes: FlowNode[], srcEdges: FlowEdge[], opts?: { offset?: { x: number; y: number }; keepSelection?: boolean; keepStep?: boolean }) => void

  // AI import
  importAIChart: (spec: AIChartSpec) => void

  // Level navigation
  expandElement:    (elementId: string) => string   // returns new screen ID
  drillDown:        (elementId: string) => void
  drillUp:          () => void
  navigateToLevel:  (index: number) => void         // jump to breadcrumb index
  jumpToLevel:      (level: number) => void          // jump directly to a level number
  unlinkExpansion:  (elementId: string) => void      // remove expansion link

  // Undo / redo
  history:     Array<{ nodes: FlowNode[]; edges: FlowEdge[] }>
  future:      Array<{ nodes: FlowNode[]; edges: FlowEdge[] }>
  pushHistory: () => void
  undo:        () => void
  redo:        () => void
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Axis-lock state (module-level so onNodesChange can intercept) ─────────────
// Set by FlowCanvas before a constrained drag, cleared on drag stop.
let _axisLock: {
  axis: 'h' | 'v'                                 // h = horizontal (lock Y), v = vertical (lock X)
  startPositions: Record<string, { x: number; y: number }>
} | null = null

export function setAxisLock(
  lock: typeof _axisLock,
) { _axisLock = lock }

export const useFlowchartStore = create<FlowchartStore>()((set, get) => ({
  metas:          [],
  charts:         {},
  activeChartId:  null,
  selectedNodeId: null,
  selectedEdgeId: null,
  loading:        false,
  currentLevel:   1,
  levelPath:      [],
  history:        [],
  future:         [],

  // ── Chart management ──────────────────────────────────────────────────────

  loadCharts: async () => {
    set({ loading: true })
    try {
      const res = await flowchartsApi.list()
      set({ metas: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createChart: async (name) => {
    const res = await flowchartsApi.create(name)
    const meta: FlowchartMeta = res.data
    set((s) => ({
      metas:  [...s.metas, meta],
      charts: { ...s.charts, [meta.id]: { nodes: [], edges: [] } },
    }))
    return meta.id
  },

  deleteChart: async (id) => {
    await flowchartsApi.delete(id)
    set((s) => {
      const metas  = s.metas.filter((m) => m.id !== id)
      const charts = { ...s.charts }
      delete charts[id]
      const activeChartId = s.activeChartId === id ? (metas[0]?.id ?? null) : s.activeChartId
      return { metas, charts, activeChartId }
    })
  },

  renameChart: async (id, name) => {
    await flowchartsApi.update(id, { name })
    set((s) => ({
      metas: s.metas.map((m) =>
        m.id === id ? { ...m, name, updated_at: new Date().toISOString() } : m,
      ),
    }))
  },

  setActiveChart: async (id) => {
    // Save the current chart before switching away to avoid data loss
    const prev = get().activeChartId
    if (prev && prev !== id) {
      const prevChart = get().charts[prev]
      if (prevChart) {
        try {
          await flowchartsApi.update(prev, { nodes: prevChart.nodes as unknown[], edges: prevChart.edges as unknown[] })
        } catch { /* best-effort save */ }
      }
    }
    // Mark loading to prevent auto-save race conditions
    set({ activeChartId: id, selectedNodeId: null, selectedEdgeId: null, currentLevel: 1, levelPath: [], loading: true })
    // Always reload from API to get the freshest data (don't trust cache)
    try {
      const res = await flowchartsApi.get(id)
      set((s) => ({
        charts: { ...s.charts, [id]: { nodes: res.data.nodes ?? [], edges: res.data.edges ?? [] } },
        loading: false,
      }))
    } catch {
      // Fall back to cache if available, otherwise empty
      const existing = get().charts[id]
      if (!existing) {
        set((s) => ({ charts: { ...s.charts, [id]: { nodes: [], edges: [] } }, loading: false }))
      } else {
        set({ loading: false })
      }
    }
  },

  saveChart: async (id) => {
    // Guard: don't save while a chart is loading (race condition protection)
    if (get().loading) return
    const chart = get().charts[id]
    if (!chart) return
    // Guard: only save if this is still the active chart
    if (get().activeChartId !== id) return
    await flowchartsApi.update(id, { nodes: chart.nodes as unknown[], edges: chart.edges as unknown[] })
    set((s) => ({
      metas: s.metas.map((m) =>
        m.id === id ? { ...m, updated_at: new Date().toISOString() } : m,
      ),
    }))
  },

  // ── React Flow change handlers ─────────────────────────────────────────────

  onNodesChange: (changes) => {
    const { activeChartId, charts } = get()
    if (!activeChartId) return
    const chart = charts[activeChartId]
    if (!chart) return
    // Apply axis-lock constraint to position changes before writing to state
    const lock = _axisLock
    const constrainedChanges = lock
      ? changes.map((change) => {
          if (change.type === 'position' && change.position) {
            const start = lock.startPositions[change.id]
            if (start) {
              return {
                ...change,
                position: {
                  x: lock.axis === 'h' ? change.position.x : start.x,
                  y: lock.axis === 'v' ? change.position.y : start.y,
                },
              }
            }
          }
          return change
        })
      : changes
    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          ...chart,
          nodes: applyNodeChanges(constrainedChanges, chart.nodes) as unknown as FlowNode[],
        },
      },
    }))
  },

  onEdgesChange: (changes) => {
    const { activeChartId, charts } = get()
    if (!activeChartId) return
    const chart = charts[activeChartId]
    if (!chart) return
    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          ...chart,
          edges: applyEdgeChanges(changes, chart.edges) as unknown as FlowEdge[],
        },
      },
    }))
  },

  onConnect: (connection) => {
    const { activeChartId, charts } = get()
    if (!activeChartId) return
    const chart = charts[activeChartId]
    if (!chart) return
    get().pushHistory()

    const sourceNode = chart.nodes.find((n) => n.id === connection.source)
    const targetNode = chart.nodes.find((n) => n.id === connection.target)

    let edgeKind: EdgeData['edgeKind'] = 'element'
    if (sourceNode?.type === 'screen' && targetNode?.type === 'screen') {
      edgeKind = 'screen'
    }

    const srcStep  = sourceNode?.type === 'element' ? ((sourceNode.data as ElementData).step ?? 1) : 1
    const destStep = targetNode?.type === 'element' ? ((targetNode.data as ElementData).step ?? 1) : 1

    let edgeStep: number
    let updatedNodes = chart.nodes
    let updatedEdges = chart.edges

    if (destStep > srcStep) {
      // dest comes after src: edge takes dest's slot, dest + everything >= destStep (except src) shifts +1
      edgeStep = destStep
      updatedNodes = chart.nodes.map((n) => {
        if (n.type !== 'element' || n.id === connection.source) return n
        const s = (n.data as ElementData).step ?? 1
        return s >= destStep ? { ...n, data: { ...n.data, step: s + 1 } } : n
      })
      updatedEdges = chart.edges.map((e) => {
        const s = (e.data as EdgeData).step ?? 1
        return s >= destStep ? { ...e, data: { ...e.data, step: s + 1 } } : e
      })
    } else {
      // dest is at same step or before src: edge simply goes after src, no shifting
      edgeStep = srcStep + 1
    }

    const newEdge: FlowEdge = {
      ...connection,
      id:     uid('edge'),
      type:   'animatedEdge',
      zIndex: 50,
      data: {
        edgeKind,
        style:     defaultEdgeStyle(),
        animation: defaultEdgeAnimation(),
        step: edgeStep,
      },
    }
    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          ...chart,
          nodes: updatedNodes,
          edges: addEdge(newEdge, updatedEdges) as unknown as FlowEdge[],
        },
      },
    }))
  },

  // ── Screen ────────────────────────────────────────────────────────────────

  addScreen: (position) => {
    const { activeChartId, currentLevel } = get()
    if (!activeChartId) return ''
    if (currentLevel > 1) return ''   // screens can only be added at level 1
    get().pushHistory()
    const id    = uid('screen')
    const chart = get().charts[activeChartId] ?? { nodes: [], edges: [] }
    const screenNodes = chart.nodes.filter((n: FlowNode) => n.type === 'screen')
    const order = screenNodes.length
    // Inherit ratio from existing screens, default 16:9
    const existingScreen = screenNodes[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ratio: AspectRatio = (existingScreen?.data as any)?.ratio ?? '16:9'
    const dim   = ASPECT_RATIO_SIZES[ratio]
    // Place near the last screen (highest order) in the nearest empty space
    const defaultPos = screenNodes.length === 0
      ? { x: 100, y: 100 }
      : (() => {
          const gap = 80
          // Find the last screen by order
          const lastScreen = screenNodes.reduce((a, b) =>
            ((a.data as ScreenData).order ?? 0) >= ((b.data as ScreenData).order ?? 0) ? a : b
          )
          const lx = lastScreen.position.x
          const ly = lastScreen.position.y
          const lw = lastScreen.width ?? dim.w
          const lh = lastScreen.height ?? dim.h

          // Candidate positions: right, below, left, above
          const candidates = [
            { x: lx + lw + gap, y: ly },           // right
            { x: lx, y: ly + lh + gap },           // below
            { x: lx - dim.w - gap, y: ly },        // left
            { x: lx, y: ly - dim.h - gap },        // above
          ]

          // Check if a candidate overlaps any existing screen
          const overlaps = (cx: number, cy: number) =>
            screenNodes.some((n: FlowNode) => {
              const nw = n.width ?? dim.w
              const nh = n.height ?? dim.h
              return cx < n.position.x + nw && cx + dim.w > n.position.x &&
                     cy < n.position.y + nh && cy + dim.h > n.position.y
            })

          const free = candidates.find(c => !overlaps(c.x, c.y))
          if (free) return free

          // Fallback: place to the right of the rightmost screen
          const maxRight = Math.max(...screenNodes.map((n: FlowNode) => n.position.x + (n.width ?? dim.w)))
          return { x: maxRight + gap, y: ly }
        })()
    const pos   = position ?? defaultPos

    const node: ScreenNode = {
      id,
      type: 'screen',
      position: pos,
      width:  dim.w,
      height: dim.h,
      style:  { width: dim.w, height: dim.h },
      data: {
        label:           `Screen ${order + 1}`,
        ratio,
        backgroundColor: '#f8fafc',
        borderColor:     '#6366f1',
        order,
      },
    }
    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          ...chart,
          nodes: [...chart.nodes, node],
        },
      },
    }))
    return id
  },

  // ── Element ───────────────────────────────────────────────────────────────

  addElement: (opts, position) => {
    const { activeChartId, selectedNodeId, currentLevel } = get()
    if (!activeChartId) return ''
    get().pushHistory()
    const id    = uid('element')
    const chart = get().charts[activeChartId] ?? { nodes: [], edges: [] }
    // Global step: one more than the highest existing element step
    const allElementSteps = chart.nodes
      .filter((n) => n.type === 'element')
      .map((n) => (n.data as ElementData).step ?? 0)
    const globalMaxStep = allElementSteps.length > 0 ? Math.max(...allElementSteps) : 0

    const isPremade = opts?.elementType === 'premade'
    const isCircle  = opts?.shape === 'circle'
    const w = (isPremade || isCircle) ? 80 : 120
    const h = (isPremade || isCircle) ? 80 : 50

    let pos: { x: number; y: number }
    if (position) {
      pos = position
    } else {
      // Place at center of selected screen, or last screen — filtered to current level
      const screens = chart.nodes.filter(
        (n: FlowNode) => n.type === 'screen' && ((n.data as ScreenData).level ?? 1) === currentLevel,
      )
      const selectedScreen = selectedNodeId ? screens.find((n: FlowNode) => n.id === selectedNodeId) : null
      const targetScreen   = selectedScreen ?? screens[screens.length - 1] ?? null
      if (targetScreen) {
        const sw = targetScreen.width  ?? 534
        const sh = targetScreen.height ?? 300
        pos = {
          x: targetScreen.position.x + sw / 2 - w / 2,
          y: targetScreen.position.y + sh / 2 - h / 2,
        }
      } else {
        pos = { x: 200, y: 200 }
      }
    }

    const node: ElementNode = {
      id,
      type:     'element',
      position: pos,
      width:    w,
      height:   h,
      style:    { width: w, height: h },
      data: {
        elementType: 'shape',
        shape:       'rectangle',
        text:        'Label',
        style:       defaultElementStyle(),
        animation:   defaultElementAnimation(),
        step:        globalMaxStep + 1,
        ...opts,
      },
    }
    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          ...chart,
          nodes: [...chart.nodes, node],
        },
      },
    }))
    return id
  },

  // ── Generic mutations ──────────────────────────────────────────────────────

  updateNode: (id, data) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    set((s) => {
      const chart = s.charts[activeChartId]
      if (!chart) return s
      return {
        charts: {
          ...s.charts,
          [activeChartId]: {
            ...chart,
            nodes: chart.nodes.map((n) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              n.id === id ? { ...n, data: { ...n.data, ...data } as any } : n,
            ),
          },
        },
      }
    })
  },

  resizeAllScreens: (width, height) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    set((s) => {
      const chart = s.charts[activeChartId]
      if (!chart) return s
      return {
        charts: {
          ...s.charts,
          [activeChartId]: {
            ...chart,
            nodes: chart.nodes.map((n) =>
              n.type !== 'screen'
                ? n
                : { ...n, width, height, style: { ...n.style, width, height } },
            ),
          },
        },
      }
    })
  },

  updateNodeSize: (id, width, height) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    set((s) => {
      const chart = s.charts[activeChartId]
      if (!chart) return s
      return {
        charts: {
          ...s.charts,
          [activeChartId]: {
            ...chart,
            nodes: chart.nodes.map((n) =>
              n.id === id
                ? { ...n, width, height, style: { ...n.style, width, height } }
                : n,
            ),
          },
        },
      }
    })
  },

  removeNode: (id) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    get().pushHistory()
    set((s) => {
      const chart = s.charts[activeChartId]
      if (!chart) return s

      // Collect all IDs to remove (cascade through expanded screens)
      const removeIds = new Set<string>([id])
      const node = chart.nodes.find((n) => n.id === id)

      // If removing an element with expandedScreenId, cascade-delete that screen + its children
      if (node?.type === 'element' && (node.data as ElementData).expandedScreenId) {
        const collectChildren = (screenId: string) => {
          removeIds.add(screenId)
          // Find all elements spatially inside this screen
          const screen = chart.nodes.find((n) => n.id === screenId)
          if (!screen) return
          const sx = screen.position.x, sy = screen.position.y
          const sw = screen.width ?? 534, sh = screen.height ?? 300
          for (const n of chart.nodes) {
            if (n.type !== 'element' || removeIds.has(n.id)) continue
            const cx = n.position.x + (n.width ?? 120) / 2
            const cy = n.position.y + (n.height ?? 50) / 2
            if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) {
              removeIds.add(n.id)
              // Recursively remove this element's expansion too
              const expId = (n.data as ElementData).expandedScreenId
              if (expId) collectChildren(expId)
            }
          }
        }
        collectChildren((node.data as ElementData).expandedScreenId!)
      }

      // If removing a screen, clear the parent element's expandedScreenId
      let updatedNodes = chart.nodes
      if (node?.type === 'screen' && (node.data as ScreenData).parentElementId) {
        const parentElId = (node.data as ScreenData).parentElementId
        updatedNodes = updatedNodes.map((n) =>
          n.id === parentElId
            ? { ...n, data: { ...n.data, expandedScreenId: undefined } }
            : n,
        )
      }

      return {
        charts: {
          ...s.charts,
          [activeChartId]: {
            ...chart,
            nodes: updatedNodes.filter((n) => !removeIds.has(n.id)),
            edges: chart.edges.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target)),
          },
        },
      }
    })
  },

  reorderNode: (id, dir) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    set((s) => {
      const chart = s.charts[activeChartId]
      if (!chart) return s

      const nodes = chart.nodes
      const idx = nodes.findIndex((n) => n.id === id)
      if (idx === -1) return s

      // Only move among element nodes; screens stay in place
      const elemIndices = nodes.map((n, i) => n.type === 'element' ? i : -1).filter((i) => i !== -1)
      const posInElems = elemIndices.indexOf(idx)
      if (posInElems === -1) return s

      let newPosInElems = posInElems
      if      (dir === 'front')    newPosInElems = elemIndices.length - 1
      else if (dir === 'back')     newPosInElems = 0
      else if (dir === 'forward')  newPosInElems = Math.min(posInElems + 1, elemIndices.length - 1)
      else if (dir === 'backward') newPosInElems = Math.max(posInElems - 1, 0)

      if (newPosInElems === posInElems) return s

      // Build new nodes array: extract element nodes, reorder them, splice back
      const elems    = elemIndices.map((i) => nodes[i])
      const [moved]  = elems.splice(posInElems, 1)
      elems.splice(newPosInElems, 0, moved)

      // Reconstruct: put screens first (they were filtered out), then elements
      // Preserve original interleaving: screens stay at their original indices
      const result = [...nodes]
      let ei = 0
      for (let i = 0; i < result.length; i++) {
        if (result[i].type === 'element') result[i] = elems[ei++]
      }

      return {
        charts: { ...s.charts, [activeChartId]: { ...chart, nodes: result } },
      }
    })
  },

  updateEdge: (id, data) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    set((s) => {
      const chart = s.charts[activeChartId]
      if (!chart) return s
      return {
        charts: {
          ...s.charts,
          [activeChartId]: {
            ...chart,
            edges: chart.edges.map((e) =>
              e.id === id ? { ...e, data: { ...e.data, ...data } as EdgeData } : e,
            ),
          },
        },
      }
    })
  },

  removeEdge: (id) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    get().pushHistory()
    set((s) => {
      const chart = s.charts[activeChartId]
      if (!chart) return s
      return {
        charts: {
          ...s.charts,
          [activeChartId]: {
            ...chart,
            edges: chart.edges.filter((e) => e.id !== id),
          },
        },
      }
    })
  },

  setChartRatio: (ratio) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    const dim = ASPECT_RATIO_SIZES[ratio]
    set((s) => {
      const chart = s.charts[activeChartId]
      if (!chart) return s
      return {
        charts: {
          ...s.charts,
          [activeChartId]: {
            ...chart,
            nodes: chart.nodes.map((n) => {
              if (n.type !== 'screen') return n
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return { ...n, width: dim.w, height: dim.h, style: { ...n.style, width: dim.w, height: dim.h }, data: { ...n.data, ratio } as any }
            }),
          },
        },
      }
    })
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  pushHistory: () => {
    const { activeChartId, charts } = get()
    if (!activeChartId) return
    const chart = charts[activeChartId]
    if (!chart) return
    set((s) => ({
      history: [...s.history.slice(-49), { nodes: chart.nodes, edges: chart.edges }],
      future:  [],
    }))
  },

  undo: () => {
    const { activeChartId, history, charts } = get()
    if (!activeChartId || !history.length) return
    const current = charts[activeChartId]
    const prev    = history[history.length - 1]
    set((s) => ({
      history:        s.history.slice(0, -1),
      future:         [...s.future.slice(-49), { nodes: current.nodes, edges: current.edges }],
      charts:         { ...s.charts, [activeChartId]: prev },
      selectedNodeId: null,
      selectedEdgeId: null,
    }))
  },

  redo: () => {
    const { activeChartId, future, charts } = get()
    if (!activeChartId || !future.length) return
    const current = charts[activeChartId]
    const next    = future[future.length - 1]
    set((s) => ({
      future:         s.future.slice(0, -1),
      history:        [...s.history.slice(-49), { nodes: current.nodes, edges: current.edges }],
      charts:         { ...s.charts, [activeChartId]: next },
      selectedNodeId: null,
      selectedEdgeId: null,
    }))
  },

  pasteElements: (srcNodes, srcEdges, opts) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    get().pushHistory()
    const chart = get().charts[activeChartId] ?? { nodes: [], edges: [] }

    const offset        = opts?.offset        ?? { x: 24, y: 24 }
    const keepSelection = opts?.keepSelection ?? false
    const keepStep      = opts?.keepStep      ?? false

    // Compute next available step (same logic as addElement)
    const allSteps = chart.nodes
      .filter((n) => n.type === 'element')
      .map((n) => (n.data as ElementData).step ?? 0)
    const maxStep = allSteps.length > 0 ? Math.max(...allSteps) : 0

    // Sort pasted nodes by their original step so relative order is preserved
    const sorted = [...srcNodes].sort((a, b) => ((a.data as ElementData).step ?? 1) - ((b.data as ElementData).step ?? 1))

    const idMap = new Map<string, string>()
    const now   = Date.now()

    const newNodes: FlowNode[] = sorted.map((n, i) => {
      const newId = uid(`element-p${now}-${i}`)
      idMap.set(n.id, newId)
      return {
        ...n,
        id:       newId,
        position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
        selected: !keepSelection,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data:     { ...n.data, ...(keepStep ? {} : { step: maxStep + 1 + i }) } as any,
      }
    })

    const newEdges: FlowEdge[] = srcEdges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e, i) => ({
        ...e,
        id:     uid(`edge-p${now}-${i}`),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }))

    const baseNodes = keepSelection
      ? chart.nodes
      : chart.nodes.map((n) => ({ ...n, selected: false }))

    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          nodes: [...baseNodes, ...newNodes],
          edges: [...chart.edges, ...newEdges],
        },
      },
      ...(keepSelection ? {} : {
        selectedNodeId: newNodes.length === 1 ? newNodes[0].id : null,
        selectedEdgeId: null,
      }),
    }))
  },

  // ── Level navigation ────────────────────────────────────────────────────────

  expandElement: (elementId) => {
    const { activeChartId, currentLevel } = get()
    if (!activeChartId) return ''
    get().pushHistory()

    const chart = get().charts[activeChartId]
    if (!chart) return ''
    const elNode = chart.nodes.find((n) => n.id === elementId && n.type === 'element')
    if (!elNode) return ''
    const elData = elNode.data as ElementData

    // If already expanded, just navigate there
    if (elData.expandedScreenId) {
      get().drillDown(elementId)
      return elData.expandedScreenId
    }

    // Find which screen this element is in to determine its level
    const elementLevel = currentLevel

    // Create new screen at next level
    const screenId = uid('screen')
    const ratio: AspectRatio = '16:9'
    const dim = ASPECT_RATIO_SIZES[ratio]

    // Position deeper-level screens far from level 1 to avoid spatial overlap.
    // Each level gets its own Y band: level 2 at y=10000, level 3 at y=20000, etc.
    const targetLevel = elementLevel + 1
    const levelYOffset = (targetLevel - 1) * 10000
    const levelScreens = chart.nodes.filter(
      (n) => n.type === 'screen' && ((n.data as ScreenData).level ?? 1) === targetLevel,
    )
    const gap = 80
    let posX = 100
    if (levelScreens.length > 0) {
      const maxRight = Math.max(...levelScreens.map((n) => n.position.x + (n.width ?? dim.w)))
      posX = maxRight + gap
    }

    const screenNode: ScreenNode = {
      id: screenId,
      type: 'screen',
      position: { x: posX, y: levelYOffset + 100 },
      width: dim.w,
      height: dim.h,
      style: { width: dim.w, height: dim.h },
      data: {
        label: elData.text || 'Expanded',
        ratio,
        backgroundColor: '#f8fafc',
        borderColor: '#6366f1',
        order: 0,
        level: elementLevel + 1,
        parentElementId: elementId,
      },
    }

    // Update the element with expandedScreenId and add the new screen
    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          ...chart,
          nodes: [
            ...chart.nodes.map((n) =>
              n.id === elementId
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? { ...n, data: { ...n.data, expandedScreenId: screenId } as any }
                : n,
            ),
            screenNode,
          ],
        },
      },
      currentLevel: elementLevel + 1,
      levelPath: [
        ...get().levelPath,
        { level: elementLevel + 1, screenId, label: screenNode.data.label, sourceElementId: elementId },
      ],
      selectedNodeId: null,
      selectedEdgeId: null,
    }))

    return screenId
  },

  drillDown: (elementId) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    const chart = get().charts[activeChartId]
    if (!chart) return

    const elNode = chart.nodes.find((n) => n.id === elementId && n.type === 'element')
    if (!elNode) return
    const expandedScreenId = (elNode.data as ElementData).expandedScreenId
    if (!expandedScreenId) return

    const screenNode = chart.nodes.find((n) => n.id === expandedScreenId)
    if (!screenNode) return
    const screenData = screenNode.data as ScreenData
    const targetLevel = screenData.level ?? 1

    set({
      currentLevel: targetLevel,
      levelPath: [
        ...get().levelPath,
        { level: targetLevel, screenId: expandedScreenId, label: screenData.label, sourceElementId: elementId },
      ],
      selectedNodeId: null,
      selectedEdgeId: null,
    })
  },

  drillUp: () => {
    const { levelPath } = get()
    if (levelPath.length === 0) return
    const newPath = levelPath.slice(0, -1)
    set({
      currentLevel: newPath.length > 0 ? newPath[newPath.length - 1].level : 1,
      levelPath: newPath,
      selectedNodeId: null,
      selectedEdgeId: null,
    })
  },

  navigateToLevel: (index) => {
    const { levelPath } = get()
    if (index < 0) {
      // Navigate to level 1
      set({ currentLevel: 1, levelPath: [], selectedNodeId: null, selectedEdgeId: null })
      return
    }
    if (index >= levelPath.length) return
    const newPath = levelPath.slice(0, index + 1)
    set({
      currentLevel: newPath[newPath.length - 1].level,
      levelPath: newPath,
      selectedNodeId: null,
      selectedEdgeId: null,
    })
  },

  jumpToLevel: (level) => {
    if (level === 1) {
      set({ currentLevel: 1, levelPath: [], selectedNodeId: null, selectedEdgeId: null })
      return
    }
    const { levelPath } = get()
    // If the level exists in our path, truncate to it
    const idx = levelPath.findIndex(e => e.level === level)
    if (idx >= 0) {
      const newPath = levelPath.slice(0, idx + 1)
      set({ currentLevel: level, levelPath: newPath, selectedNodeId: null, selectedEdgeId: null })
    } else {
      // Level exists in the chart but not in the path — just set it directly
      set({ currentLevel: level, selectedNodeId: null, selectedEdgeId: null })
    }
  },

  unlinkExpansion: (elementId) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    get().pushHistory()
    const chart = get().charts[activeChartId]
    if (!chart) return

    const elNode = chart.nodes.find((n) => n.id === elementId)
    if (!elNode) return
    const expandedScreenId = (elNode.data as ElementData).expandedScreenId
    if (!expandedScreenId) return

    // Collect all nodes/edges belonging to the expanded screen and its children
    const removeIds = new Set<string>()
    const collectChildren = (screenId: string) => {
      removeIds.add(screenId)
      const screen = chart.nodes.find((n) => n.id === screenId)
      if (!screen) return
      const sx = screen.position.x, sy = screen.position.y
      const sw = screen.width ?? 534, sh = screen.height ?? 300
      for (const n of chart.nodes) {
        if (n.type !== 'element' || removeIds.has(n.id)) continue
        const cx = n.position.x + (n.width ?? 120) / 2
        const cy = n.position.y + (n.height ?? 50) / 2
        if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) {
          removeIds.add(n.id)
          const expId = (n.data as ElementData).expandedScreenId
          if (expId) collectChildren(expId)
        }
      }
    }
    collectChildren(expandedScreenId)

    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          ...chart,
          nodes: chart.nodes
            .map((n) =>
              n.id === elementId
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? { ...n, data: { ...n.data, expandedScreenId: undefined } as any }
                : n,
            )
            .filter((n) => !removeIds.has(n.id)),
          edges: chart.edges.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target)),
        },
      },
    }))
  },

  // ── AI import ──────────────────────────────────────────────────────────────

  importAIChart: (spec) => {
    const { activeChartId } = get()
    if (!activeChartId) return
    get().pushHistory()

    const chart    = get().charts[activeChartId] ?? { nodes: [], edges: [] }
    const now      = Date.now()

    // Position screens to the right of existing content
    const existingScreens = chart.nodes.filter((n) => n.type === 'screen')
    let startX = existingScreens.length === 0 ? 80 : (() => {
      const maxRight = Math.max(...existingScreens.map((n) => n.position.x + (n.width ?? 534)))
      return maxRight + 120
    })()
    const startY = existingScreens.length === 0 ? 80
      : Math.min(...existingScreens.map((n) => n.position.y))

    const newNodes: FlowNode[] = []
    const newEdges: FlowEdge[] = []

    // Map AI element IDs → real UIDs (global across all screens)
    const idMap = new Map<string, string>()

    const sortedScreens = [...spec.screens].sort((a, b) => a.order - b.order)

    sortedScreens.forEach((aiScreen, si) => {
      const ratio = (aiScreen.ratio ?? '16:9') as AspectRatio
      const dim   = ASPECT_RATIO_SIZES[ratio] ?? ASPECT_RATIO_SIZES['16:9']

      // Screen position: lay out side by side with 80px gap
      const screenX = startX + si * (dim.w + 80)
      const screenY = startY

      const screenId = uid(`screen-ai-${now}-${si}`)
      const screenNode: ScreenNode = {
        id:       screenId,
        type:     'screen',
        position: { x: screenX, y: screenY },
        width:    dim.w,
        height:   dim.h,
        style:    { width: dim.w, height: dim.h },
        data: {
          label:           aiScreen.label ?? `Screen ${si + 1}`,
          ratio,
          backgroundColor: aiScreen.backgroundColor ?? '#f8fafc',
          borderColor:     aiScreen.borderColor ?? '#6366f1',
          order:           aiScreen.order,
        },
      }
      newNodes.push(screenNode)

      // Elements — positions are relative to screen top-left
      ;(aiScreen.elements ?? []).forEach((aiEl, ei) => {
        const realId = uid(`element-ai-${now}-${si}-${ei}`)
        idMap.set(aiEl.id, realId)

        const elementNode: ElementNode = {
          id:       realId,
          type:     'element',
          position: {
            x: screenX + (aiEl.x ?? 0),
            y: screenY + (aiEl.y ?? 0),
          },
          width:  aiEl.width  ?? 120,
          height: aiEl.height ?? 50,
          style:  { width: aiEl.width ?? 120, height: aiEl.height ?? 50 },
          data: {
            elementType:     aiEl.elementType ?? 'shape',
            shape:           aiEl.shape,
            premadeType:     aiEl.premadeType,
            lottieUrl:       aiEl.lottieUrl,
            lottiePrimary:   aiEl.lottiePrimary ?? '#000000',
            lottieSecondary: aiEl.lottieSecondary ?? '#6366f1',
            lottieDelay:     aiEl.lottieDelay ?? 500,
            text:            aiEl.text ?? '',
            step:            aiEl.step ?? 1,
            style: {
              ...defaultElementStyle(),
              ...(aiEl.style ?? {}),
            },
            animation: {
              ...defaultElementAnimation(),
              ...(aiEl.animation ?? {}),
            },
          },
        }
        newNodes.push(elementNode)
      })

      // Edges — source/target use AI IDs, mapped to real IDs
      ;(aiScreen.edges ?? []).forEach((aiEdge, ei) => {
        const srcId = idMap.get(aiEdge.source)
        const tgtId = idMap.get(aiEdge.target)
        if (!srcId || !tgtId) return

        const edgeId = uid(`edge-ai-${now}-${si}-${ei}`)
        const edgeNode: FlowEdge = {
          id:     edgeId,
          source: srcId,
          target: tgtId,
          type:   'animatedEdge',
          zIndex: 50,
          ...(aiEdge.label ? { label: aiEdge.label } : {}),
          data: {
            edgeKind:  'element',
            label:     aiEdge.label ?? '',
            step:      aiEdge.step ?? 1,
            style: {
              ...defaultEdgeStyle(),
              ...(aiEdge.style ?? {}),
            },
            animation: {
              ...defaultEdgeAnimation(),
              ...(aiEdge.animation ?? {}),
            },
          },
        }
        newEdges.push(edgeNode)
      })
    })

    set((s) => ({
      charts: {
        ...s.charts,
        [activeChartId]: {
          nodes: [...chart.nodes, ...newNodes],
          edges: [...chart.edges, ...newEdges],
        },
      },
      selectedNodeId: null,
      selectedEdgeId: null,
    }))
  },
}))

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectNodes = (s: FlowchartStore): FlowNode[] =>
  s.activeChartId ? (s.charts[s.activeChartId]?.nodes ?? []) : []

export const selectEdges = (s: FlowchartStore): FlowEdge[] =>
  s.activeChartId ? (s.charts[s.activeChartId]?.edges ?? []) : []

// ── Level-aware selectors ────────────────────────────────────────────────────

export const selectCurrentLevel = (s: { currentLevel: number }) => s.currentLevel
export const selectLevelPath    = (s: { levelPath: LevelPathEntry[] }) => s.levelPath

/** Returns only the screens at the given level + elements spatially inside those screens */
export function nodesForLevel(allNodes: FlowNode[], level: number): FlowNode[] {
  // Screens belong to a level by their explicit `level` field (default 1 if omitted)
  const levelScreens = allNodes.filter(
    (n) => n.type === 'screen' && ((n.data as ScreenData).level ?? 1) === level,
  )

  const result: FlowNode[] = [...levelScreens]

  for (const n of allNodes) {
    if (n.type !== 'element') continue
    const cx = n.position.x + (n.width ?? 120) / 2
    const cy = n.position.y + (n.height ?? 50) / 2

    // Check if element is inside one of the level's screens
    let inLevelScreen = false
    for (const scr of levelScreens) {
      const sx = scr.position.x, sy = scr.position.y
      const sw = scr.width ?? 534, sh = scr.height ?? 300
      if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) {
        inLevelScreen = true
        break
      }
    }
    if (inLevelScreen) {
      result.push(n)
    }
  }
  return result
}

/** Returns edges whose source and target are both in the given node set */
export function edgesForNodes(allEdges: FlowEdge[], nodeIds: Set<string>): FlowEdge[] {
  return allEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
}

