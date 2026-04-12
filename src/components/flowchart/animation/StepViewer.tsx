import { memo, useState } from 'react'
import { useFlowchartStore, selectNodes, selectEdges } from '../../../store/useFlowchartStore'
import type { ElementData, EdgeData, ScreenData } from '../../../types/flowchart'
import { ASPECT_RATIO_SIZES } from '../../../types/flowchart'

// ── Types ─────────────────────────────────────────────────────────────────────

type StepItem = {
  kind: 'element' | 'edge'
  id: string
  label: string
  screen: string
  typeLabel: string
  step: number
}

// ── Data hook ─────────────────────────────────────────────────────────────────

function useStageData() {
  const nodes = useFlowchartStore(selectNodes)
  const edges = useFlowchartStore(selectEdges)

  const screenNodes = nodes.filter((n) => n.type === 'screen')
  const screens = screenNodes.map((n) => {
    const ratio = (n.data as ScreenData).ratio as keyof typeof ASPECT_RATIO_SIZES
    return {
      x: n.position.x, y: n.position.y,
      w: n.width  ?? ASPECT_RATIO_SIZES[ratio]?.w ?? 534,
      h: n.height ?? ASPECT_RATIO_SIZES[ratio]?.h ?? 300,
      label: (n.data as ScreenData).label,
    }
  })

  function screenOf(node: typeof nodes[0]): string {
    const ew = node.width ?? 120, eh = node.height ?? 50
    const cx = node.position.x + ew / 2, cy = node.position.y + eh / 2
    return screens.find((s) => cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h)?.label ?? '—'
  }

  const stageMap = new Map<number, StepItem[]>()

  nodes.filter((n) => n.type === 'element').forEach((n) => {
    const d = n.data as ElementData
    const step = d.step ?? 1
    const typeLabel =
      d.elementType === 'premade' ? (d.premadeType?.replace(/^(lucide|lottie)-/, '') ?? 'premade') :
      d.elementType === 'shape'   ? (d.shape ?? 'shape') : d.elementType
    const arr = stageMap.get(step) ?? []
    arr.push({ kind: 'element', id: n.id, label: d.text?.trim() || `[${typeLabel}]`, screen: screenOf(n), typeLabel, step })
    stageMap.set(step, arr)
  })

  edges.forEach((e) => {
    const d = e.data as EdgeData
    if (d?.step === undefined) return
    const srcNode = nodes.find((n) => n.id === e.source)
    const tgtNode = nodes.find((n) => n.id === e.target)
    const from = (srcNode?.data as ElementData)?.text?.trim() || '?'
    const to   = (tgtNode?.data as ElementData)?.text?.trim() || '?'
    const scr  = srcNode ? screenOf(srcNode) : '—'
    const arr  = stageMap.get(d.step) ?? []
    arr.push({ kind: 'edge', id: e.id, label: `${from} → ${to}`, screen: scr, typeLabel: 'edge', step: d.step })
    stageMap.set(d.step, arr)
  })

  return { stageMap, nodes, edges }
}

// ── Item chip ─────────────────────────────────────────────────────────────────

function ItemChip({
  item,
  onDragStart,
}: {
  item: StepItem
  onDragStart: (item: StepItem) => void
}) {
  const isEdge = item.kind === 'edge'
  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(item) }}
      title="Drag to move to another step"
      style={{
        display: 'flex', alignItems: 'center', gap: 5, cursor: 'grab',
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 5, padding: '3px 8px', maxWidth: 190,
      }}
    >
      <span style={{
        fontSize: 7, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700,
        textTransform: 'uppercase', padding: '1px 4px', borderRadius: 3, flexShrink: 0,
        color:      isEdge ? '#b45309' : '#6366f1',
        background: isEdge ? '#fef3c7' : '#ede9fe',
      }}>
        {item.typeLabel}
      </span>
      <span style={{ fontSize: 10, color: '#1e293b', fontFamily: 'IBM Plex Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {item.label}
      </span>
      <span style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>
        {item.screen}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const StepViewer = memo(({ onClose }: { onClose: () => void }) => {
  const { stageMap, nodes, edges } = useStageData()
  const { updateNode, updateEdge } = useFlowchartStore()

  // Extra empty steps created by "insert step"
  const [emptySteps, setEmptySteps] = useState<Set<number>>(new Set())
  // Currently dragged chip
  const [dragItem, setDragItem] = useState<StepItem | null>(null)
  // Which step the dragged chip is hovering over
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  // All step numbers to display (populated + empty)
  const allSteps = [...new Set([...stageMap.keys(), ...emptySteps])].sort((a, b) => a - b)
  const totalItems = [...stageMap.values()].reduce((s, arr) => s + arr.length, 0)

  // ── Helpers ───────────────────────────────────────────────────────────────

  function applyStepChanges(changes: Map<string, number>) {
    nodes.filter((n) => n.type === 'element').forEach((n) => {
      const next = changes.get(n.id)
      if (next !== undefined) updateNode(n.id, { step: next })
    })
    edges.forEach((e) => {
      const next = changes.get(e.id)
      if (next !== undefined) updateEdge(e.id, { step: next })
    })
  }

  // Move all items at stepA to stepB and vice-versa (swap two stages)
  function swapStages(stepA: number, stepB: number) {
    const changes = new Map<string, number>()
    ;(stageMap.get(stepA) ?? []).forEach((item) => changes.set(item.id, stepB))
    ;(stageMap.get(stepB) ?? []).forEach((item) => changes.set(item.id, stepA))
    applyStepChanges(changes)
    setEmptySteps((prev) => {
      const next = new Set(prev)
      // carry empty-step markers through the swap
      const aEmpty = !stageMap.has(stepA), bEmpty = !stageMap.has(stepB)
      if (aEmpty) { next.delete(stepA); next.add(stepB) }
      if (bEmpty) { next.delete(stepB); next.add(stepA) }
      return next
    })
  }

  // Insert a new empty step AFTER stepN — shift everything > stepN up by 1
  function insertAfter(stepN: number) {
    const changes = new Map<string, number>()
    nodes.filter((n) => n.type === 'element').forEach((n) => {
      const s = (n.data as ElementData).step ?? 1
      if (s > stepN) changes.set(n.id, s + 1)
    })
    edges.forEach((e) => {
      const s = (e.data as EdgeData).step ?? 1
      if (s > stepN) changes.set(e.id, s + 1)
    })
    applyStepChanges(changes)
    // Also shift any existing empty-step markers that are > stepN
    setEmptySteps((prev) => {
      const next = new Set<number>()
      prev.forEach((s) => next.add(s > stepN ? s + 1 : s))
      next.add(stepN + 1)   // the new empty slot
      return next
    })
  }

  // Delete an empty step — shift everything > stepN down by 1
  function deleteEmptyStep(stepN: number) {
    if (stageMap.has(stepN)) return  // only for empty steps
    const changes = new Map<string, number>()
    nodes.filter((n) => n.type === 'element').forEach((n) => {
      const s = (n.data as ElementData).step ?? 1
      if (s > stepN) changes.set(n.id, s - 1)
    })
    edges.forEach((e) => {
      const s = (e.data as EdgeData).step ?? 1
      if (s > stepN) changes.set(e.id, s - 1)
    })
    applyStepChanges(changes)
    setEmptySteps((prev) => {
      const next = new Set<number>()
      prev.forEach((s) => { if (s !== stepN) next.add(s > stepN ? s - 1 : s) })
      return next
    })
  }

  // Assign dragged chip to a different step
  function dropOnStep(targetStep: number) {
    if (!dragItem || dragItem.step === targetStep) { setDragItem(null); setDropTarget(null); return }
    const srcStep  = dragItem.step
    const srcItems = stageMap.get(srcStep) ?? []
    if (dragItem.kind === 'element') updateNode(dragItem.id, { step: targetStep })
    else updateEdge(dragItem.id, { step: targetStep })
    setEmptySteps((prev) => {
      const next = new Set(prev)
      next.delete(targetStep)            // target was empty, now has an item
      if (srcItems.length === 1) next.add(srcStep)  // source had only this chip, now empty
      return next
    })
    setDragItem(null)
    setDropTarget(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 10, width: 580, maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px #00000040' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Step Viewer
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>
            {totalItems} item{totalItems !== 1 ? 's' : ''} · {allSteps.length} step{allSteps.length !== 1 ? 's' : ''} · drag chips to reassign
          </span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {allSteps.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', padding: '48px 0' }}>
              No elements yet. Add screens and elements to get started.
            </div>
          ) : (
            <>
              {/* Insert-before first step */}
              <InsertDivider onInsert={() => insertAfter(allSteps[0] - 1)} />

              {allSteps.map((step, idx) => {
                const items = stageMap.get(step) ?? []
                const isEmpty = items.length === 0
                const isDropTarget = dropTarget === step
                const prevStep = idx > 0 ? allSteps[idx - 1] : null

                return (
                  <div key={step}>
                    {/* Stage row */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDropTarget(step) }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={() => dropOnStep(step)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '8px 6px', borderRadius: 7,
                        background: isDropTarget ? '#f0f0ff' : isEmpty ? '#fafafa' : 'transparent',
                        border: isDropTarget ? '1.5px dashed #6366f1' : '1.5px solid transparent',
                        transition: 'background .1s, border-color .1s',
                      }}
                    >
                      {/* Step badge */}
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: isEmpty ? '#e2e8f0' : '#6366f1', color: isEmpty ? '#94a3b8' : '#fff', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: isEmpty ? 'none' : '0 0 0 3px #ede9fe', marginTop: 1 }}>
                        {step}
                      </div>

                      {/* Items side by side */}
                      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, minHeight: 28, alignItems: 'center' }}>
                        {isEmpty ? (
                          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', fontStyle: 'italic' }}>
                            empty — drop a chip here to assign
                          </span>
                        ) : (
                          items.map((item) => (
                            <ItemChip key={item.id} item={item} onDragStart={setDragItem} />
                          ))
                        )}
                      </div>

                      {/* Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, paddingTop: 2 }}>
                        {isEmpty && (
                          <button
                            onClick={() => deleteEmptyStep(step)}
                            title="Delete this empty step (shift all below steps -1)"
                            style={{ width: 20, height: 20, border: '1px solid #fca5a5', borderRadius: 3, background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          >×</button>
                        )}
                        <button
                          onClick={() => { if (idx > 0 && prevStep !== null) swapStages(step, prevStep) }}
                          disabled={idx === 0}
                          title="Move step up"
                          style={{ width: 20, height: 20, border: '1px solid #e2e8f0', borderRadius: 3, background: '#f8fafc', color: idx === 0 ? '#cbd5e1' : '#475569', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >↑</button>
                        <button
                          onClick={() => { if (idx < allSteps.length - 1) swapStages(step, allSteps[idx + 1]) }}
                          disabled={idx === allSteps.length - 1}
                          title="Move step down"
                          style={{ width: 20, height: 20, border: '1px solid #e2e8f0', borderRadius: 3, background: '#f8fafc', color: idx === allSteps.length - 1 ? '#cbd5e1' : '#475569', cursor: idx === allSteps.length - 1 ? 'default' : 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >↓</button>
                      </div>
                    </div>

                    {/* Insert-after divider */}
                    <InsertDivider onInsert={() => insertAfter(step)} />
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, color: '#475569', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
})

StepViewer.displayName = 'StepViewer'

// ── Insert divider ─────────────────────────────────────────────────────────────

function InsertDivider({ onInsert }: { onInsert: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onInsert}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', cursor: 'pointer', opacity: hover ? 1 : 0.3, transition: 'opacity .15s' }}
    >
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      <span style={{ fontSize: 9, color: '#6366f1', fontFamily: 'IBM Plex Mono, monospace', background: '#ede9fe', borderRadius: 3, padding: '1px 7px', fontWeight: 700, userSelect: 'none' }}>
        + step
      </span>
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </div>
  )
}
