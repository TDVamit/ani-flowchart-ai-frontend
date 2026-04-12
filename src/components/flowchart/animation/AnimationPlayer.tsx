import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider, ReactFlowInstance, useReactFlow } from '@xyflow/react'
import { useFlowchartStore, selectNodes, selectEdges } from '../../../store/useFlowchartStore'
import type { ScreenData, ElementData, EdgeData } from '../../../types/flowchart'
import { ASPECT_RATIO_SIZES } from '../../../types/flowchart'
import { getBezierPath, getStraightPath, Position } from '@xyflow/system'
import FlowCanvas from '../FlowCanvas'
import type { NodeAnimState } from '../PresentationContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorldElement {
  id: string
  data: ElementData
  relX: number
  relY: number
  w: number
  h: number
}

interface WorldEdge {
  id: string
  data: EdgeData
  path: string
  labelX: number
  labelY: number
}

interface ScreenFrame {
  screenId: string
  data: ScreenData
  elements: WorldElement[]
  edges: WorldEdge[]
  canvasX: number
  canvasY: number
  canvasW: number
  canvasH: number
}

interface CrossEdge {
  id: string
  data: EdgeData
  path: string
  srcFrameIdx: number
  tgtFrameIdx: number
  labelX: number
  labelY: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function handlePoint(
  el: { relX: number; relY: number; w: number; h: number },
  handle: string | null | undefined,
): [number, number] {
  switch (handle) {
    case 'top': return [el.relX + el.w / 2, el.relY]
    case 'bottom': return [el.relX + el.w / 2, el.relY + el.h]
    case 'left': return [el.relX, el.relY + el.h / 2]
    case 'right': return [el.relX + el.w, el.relY + el.h / 2]
    default: return [el.relX + el.w / 2, el.relY + el.h / 2]
  }
}

function strToPos(h: string | null | undefined): Position {
  if (h === 'top') return Position.Top
  if (h === 'bottom') return Position.Bottom
  if (h === 'left') return Position.Left
  return Position.Right
}

function alignTurns(
  turns: Array<{ x: number; y: number }>,
  sx: number, sy: number, sp: Position,
  tx: number, ty: number, tp: Position,
): Array<{ x: number; y: number }> {
  if (turns.length === 0) return turns
  const out = turns.map((t) => ({ ...t }))
  const srcH = sp === Position.Right || sp === Position.Left
  const tgtH = tp === Position.Right || tp === Position.Left
  const last = out.length - 1
  if (srcH) out[0].y = sy; else out[0].x = sx
  if (tgtH) out[last].y = ty; else out[last].x = tx
  if (last < 1) return out
  const mid = Math.floor(last / 2)
  let segH = srcH
  for (let i = 1; i <= mid; i++) {
    segH = !segH
    if (segH) out[i].y = out[i - 1].y; else out[i].x = out[i - 1].x
  }
  segH = tgtH
  for (let i = last - 1; i > mid; i--) {
    segH = !segH
    if (segH) out[i].y = out[i + 1].y; else out[i].x = out[i + 1].x
  }
  return out
}

function buildStepPathFromTurns(
  sx: number, sy: number, tx: number, ty: number,
  turns: Array<{ x: number; y: number }>,
  br: number,
): string {
  const pts = [{ x: sx, y: sy }, ...turns, { x: tx, y: ty }]
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i]
    if (i < pts.length - 1 && br > 0) {
      const next = pts[i + 1]
      const d1x = Math.sign(cur.x - prev.x) || 0
      const d1y = Math.sign(cur.y - prev.y) || 0
      const d2x = Math.sign(next.x - cur.x) || 0
      const d2y = Math.sign(next.y - cur.y) || 0
      if (d1x !== d2x || d1y !== d2y) {
        const len1 = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y)
        const len2 = Math.abs(next.x - cur.x) + Math.abs(next.y - cur.y)
        const r = Math.min(br, len1 / 2, len2 / 2)
        if (r > 1) {
          d += ` L ${cur.x - d1x * r} ${cur.y - d1y * r}`
          d += ` Q ${cur.x} ${cur.y} ${cur.x + d2x * r} ${cur.y + d2y * r}`
          continue
        }
      }
    }
    d += ` L ${cur.x} ${cur.y}`
  }
  return d
}

const STEP_GAP = 25

function computeDefaultTurns(
  sx: number, sy: number, sp: Position,
  tx: number, ty: number, tp: Position,
): Array<{ x: number; y: number }> {
  const G = STEP_GAP
  const srcH = sp === Position.Right || sp === Position.Left
  const tgtH = tp === Position.Right || tp === Position.Left

  if (srcH && tgtH) {
    const sDir = sp === Position.Right ? 1 : -1
    const tDir = tp === Position.Right ? 1 : -1
    const sEdge = sx + sDir * G
    const tEdge = tx + tDir * G
    if (sDir !== tDir && sDir * (tEdge - sEdge) > 0) {
      const mx = (sx + tx) / 2
      return [{ x: mx, y: sy }, { x: mx, y: ty }]
    }
    if (sDir === tDir) {
      const ex = sDir === 1 ? Math.max(sEdge, tEdge) : Math.min(sEdge, tEdge)
      return [{ x: ex, y: sy }, { x: ex, y: ty }]
    }
    const my = (sy + ty) / 2
    return [{ x: sEdge, y: sy }, { x: sEdge, y: my }, { x: tEdge, y: my }, { x: tEdge, y: ty }]
  }

  if (!srcH && !tgtH) {
    const sDir = sp === Position.Bottom ? 1 : -1
    const tDir = tp === Position.Bottom ? 1 : -1
    const sEdge = sy + sDir * G
    const tEdge = ty + tDir * G
    if (sDir !== tDir && sDir * (tEdge - sEdge) > 0) {
      const my = (sy + ty) / 2
      return [{ x: sx, y: my }, { x: tx, y: my }]
    }
    if (sDir === tDir) {
      const ey = sDir === 1 ? Math.max(sEdge, tEdge) : Math.min(sEdge, tEdge)
      return [{ x: sx, y: ey }, { x: tx, y: ey }]
    }
    const mx = (sx + tx) / 2
    return [{ x: sx, y: sEdge }, { x: mx, y: sEdge }, { x: mx, y: tEdge }, { x: tx, y: tEdge }]
  }

  if (srcH) {
    const sDir = sp === Position.Right ? 1 : -1
    const tDir = tp === Position.Bottom ? 1 : -1
    if (sDir * (tx - sx) > G && tDir * (ty - sy) > G) {
      return [{ x: tx, y: sy }]
    }
    const mx = (sx + tx) / 2
    const tEdge = ty + tDir * G
    return [{ x: mx, y: sy }, { x: mx, y: tEdge }, { x: tx, y: tEdge }]
  } else {
    const sDir = sp === Position.Bottom ? 1 : -1
    const tDir = tp === Position.Right ? 1 : -1
    if (sDir * (ty - sy) > G && tDir * (tx - sx) > G) {
      return [{ x: sx, y: ty }]
    }
    const my = (sy + ty) / 2
    const tEdge = tx + tDir * G
    return [{ x: sx, y: my }, { x: tEdge, y: my }, { x: tEdge, y: ty }]
  }
}

function buildPath(
  sx: number, sy: number, tx: number, ty: number,
  pathType: string,
  srcHandle?: string | null, tgtHandle?: string | null,
  _pathOffset?: { x: number; y: number } | null,
  edgeBorderRadius?: number,
  turns?: Array<{ x: number; y: number }> | null,
): string {
  if ([sx, sy, tx, ty].some((v) => !isFinite(v))) return 'M 0 0 L 0 0'
  const isStep = pathType === 'step' || pathType === 'smoothstep'
  const br = pathType === 'smoothstep' ? (edgeBorderRadius ?? 10) : (edgeBorderRadius ?? 0)

  if (isStep) {
    const sp = strToPos(srcHandle)
    const tp = strToPos(tgtHandle)
    // Always use our own path builder to match canvas exactly
    const activeTurns = (turns && turns.length > 0)
      ? alignTurns(turns, sx, sy, sp, tx, ty, tp)
      : computeDefaultTurns(sx, sy, sp, tx, ty, tp)
    return buildStepPathFromTurns(sx, sy, tx, ty, activeTurns, br)
  }

  const sp = strToPos(srcHandle)
  const tp = strToPos(tgtHandle)
  if (pathType === 'straight') return getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty })[0]
  return getBezierPath({ sourceX: sx, sourceY: sy, sourcePosition: sp, targetX: tx, targetY: ty, targetPosition: tp })[0]
}

function computeTotalAnimTime(frame: ScreenFrame): number {
  const sorted = [...frame.elements].sort((a, b) => (a.data.step ?? 1) - (b.data.step ?? 1))
  const steps = [...new Set([
    ...sorted.map((el) => el.data.step ?? 1),
    ...frame.edges.map((e) => e.data.step ?? 1),
  ])].sort((a, b) => a - b)
  let total = 0
  for (const step of steps) {
    const stepEls = sorted.filter((el) => (el.data.step ?? 1) === step)
    const stepEdges = frame.edges.filter((e) => (e.data.step ?? 1) === step)
    const maxElAnim = stepEls.length ? Math.max(...stepEls.map((el) => el.data.animation.delay + el.data.animation.duration)) : 0
    const maxEdAnim = stepEdges.length ? Math.max(...stepEdges.map((e) => (e.data.animation?.delay ?? 0) + (e.data.animation?.inDuration ?? 0.4))) : 0
    const maxAnim = Math.max(maxElAnim, maxEdAnim, 0.3)
    const maxElStay = stepEls.length ? Math.max(...stepEls.map((el) => el.data.animation.stay ?? 0)) : 0
    const maxEdStay = stepEdges.length ? Math.max(...stepEdges.map((e) => e.data.animation?.stay ?? 0)) : 0
    const maxStay = Math.max(maxElStay, maxEdStay, 0)
    total += maxAnim + maxStay
  }
  return Math.max(total, 0.5)
}

function buildStepStartMap(elements: WorldElement[], edges: WorldEdge[]): Map<number, number> {
  const sorted = [...elements].sort((a, b) => (a.data.step ?? 1) - (b.data.step ?? 1))
  const allSteps = [
    ...sorted.map((el) => el.data.step ?? 1),
    ...edges.map((e) => e.data.step ?? 1),
  ]
  const uniqueSteps = [...new Set(allSteps)].sort((a, b) => a - b)
  const map = new Map<number, number>()
  let t = 0
  for (const step of uniqueSteps) {
    map.set(step, t)
    const stepEls = sorted.filter((el) => (el.data.step ?? 1) === step)
    const stepEdges = edges.filter((e) => (e.data.step ?? 1) === step)
    const maxElAnim = stepEls.length ? Math.max(...stepEls.map((el) => el.data.animation.delay + el.data.animation.duration)) : 0
    const maxEdAnim = stepEdges.length ? Math.max(...stepEdges.map((e) => (e.data.animation?.delay ?? 0) + (e.data.animation?.inDuration ?? 0.4))) : 0
    const maxAnim = Math.max(maxElAnim, maxEdAnim, 0.3)
    const maxElStay = stepEls.length ? Math.max(...stepEls.map((el) => el.data.animation.stay ?? 0)) : 0
    const maxEdStay = stepEdges.length ? Math.max(...stepEdges.map((e) => e.data.animation?.stay ?? 0)) : 0
    const maxStay = Math.max(maxElStay, maxEdStay, 0)
    t += maxAnim + maxStay
  }
  return map
}

// ── SVG Edge Overlay ──────────────────────────────────────────────────────────
// Renders ALL edges on top of screen nodes via a separate SVG layer.
// Uses a single outer <g> with viewport transform (updated via ref during pan
// for zero-rerender animation), with per-frame nested <g> for screen-local edges
// and cross-screen edges directly in world coordinates.

const DRAW_DASH = 10000

/** Hook: animate a <g> element along an SVG path using JS (reliable in React). */
function useMotionAlongPath(
  pathD: string,
  duration: number,
  repeatCount: string,
  rotate: boolean,
) {
  const gRef = useRef<SVGGElement>(null)
  const pathElRef = useRef<SVGPathElement | null>(null)

  useEffect(() => {
    // Create a temporary offscreen path to call getPointAtLength on
    const ns = 'http://www.w3.org/2000/svg'
    const p = document.createElementNS(ns, 'path')
    p.setAttribute('d', pathD)
    pathElRef.current = p

    const totalLen = p.getTotalLength()
    if (totalLen === 0) return

    let animId: number
    let start: number | null = null
    const durMs = duration * 1000
    const infinite = repeatCount === 'indefinite'
    const count = infinite ? Infinity : (parseInt(repeatCount, 10) || 1)

    function tick(ts: number) {
      if (!start) start = ts
      const elapsed = ts - start
      const totalDur = durMs * count
      if (!infinite && elapsed >= totalDur) {
        // park at end
        const pt = p.getPointAtLength(totalLen)
        if (gRef.current) gRef.current.setAttribute('transform', `translate(${pt.x},${pt.y})`)
        return
      }
      const t = (elapsed % durMs) / durMs
      const pt = p.getPointAtLength(t * totalLen)
      let xform = `translate(${pt.x},${pt.y})`
      if (rotate) {
        // approximate angle from a small delta
        const dt = Math.min(t + 0.001, 1)
        const pt2 = p.getPointAtLength(dt * totalLen)
        const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * (180 / Math.PI)
        xform += ` rotate(${angle})`
      }
      if (gRef.current) gRef.current.setAttribute('transform', xform)
      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [pathD, duration, repeatCount, rotate])

  return gRef
}

function FlowDot({ path, size, color, dur, repeat }: { path: string; size: number; color: string; dur: number; repeat: string }) {
  const gRef = useMotionAlongPath(path, dur, repeat, true)
  return (
    <g ref={gRef}>
      <circle r={Math.max(2, size / 2)} fill={color} />
    </g>
  )
}

function FlowText({ path, text, size, color, dur, repeat }: { path: string; text: string; size: number; color: string; dur: number; repeat: string }) {
  const gRef = useMotionAlongPath(path, dur, repeat, false)
  return (
    <g ref={gRef}>
      <text
        fontSize={size}
        fill={color}
        stroke="white"
        strokeWidth={Math.max(2, size * 0.35)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="IBM Plex Mono, monospace"
        style={{ paintOrder: 'stroke fill' }}
      >
        {text}
      </text>
    </g>
  )
}

function EdgePathGroup({ e }: { e: WorldEdge }) {
  const s = e.data.style
  const anim = e.data.animation
  const inType = anim?.inType ?? 'none'
  const inDur = anim?.inDuration ?? 0.4
  const animType = anim?.type ?? 'none'
  const animDur = anim?.duration ?? 1
  const loop = anim?.loop ?? 'none'
  const loopCount = anim?.loopCount ?? 1
  const fc = anim?.flowContent
  const hasArrow = s.arrowType !== 'none' && s.arrowType !== 'image'

  const isDraw = inType === 'draw'
  const isFadeIn = inType === 'fade-in'
  const isFlow = animType === 'flow'

  // For draw animation: measure actual path length for accurate drawing
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLen, setPathLen] = useState(DRAW_DASH)
  // Hide arrowhead during draw and reveal after animation completes
  const [drawDone, setDrawDone] = useState(!isDraw)
  useEffect(() => {
    if (isDraw && pathRef.current) {
      const len = pathRef.current.getTotalLength()
      setPathLen(len > 0 ? len : DRAW_DASH)
    }
  }, [isDraw, e.path])
  useEffect(() => {
    if (!isDraw) { setDrawDone(true); return }
    setDrawDone(false)
    const timer = setTimeout(() => setDrawDone(true), inDur * 1000)
    return () => clearTimeout(timer)
  }, [isDraw, inDur, e.id]) // eslint-disable-line react-hooks/exhaustive-deps

  let dashArray: string | undefined
  if (isDraw) dashArray = `${pathLen} ${pathLen}`
  else if (isFlow) dashArray = '12 6'
  else if (animType === 'dash') dashArray = '8 4'
  else if (s.lineType === 'dashed') dashArray = '8 4'
  else if (s.lineType === 'dotted') dashArray = '2 3'

  const repeatCount = loop === 'none' ? String(loopCount) : 'indefinite'

  // Use CSS animations for one-shot draw/fade-in — SMIL begin="0s" fires
  // relative to document load time (already past), so it never plays.
  const cssAnim = isDraw
    ? `edge-draw-css ${inDur}s ease forwards`
    : isFadeIn
    ? `edge-fade-css ${inDur}s ease forwards`
    : undefined

  return (
    <g>
      <path
        ref={pathRef}
        d={e.path}
        stroke={s.color}
        strokeWidth={s.strokeWidth}
        strokeDasharray={dashArray}
        strokeDashoffset={isDraw ? pathLen : undefined}
        opacity={isFadeIn ? 0 : undefined}
        fill="none"
        markerEnd={hasArrow && drawDone ? `url(#pm-${e.id})` : undefined}
        style={cssAnim ? { animation: cssAnim } : undefined}
      >
        {animType === 'pulse' && <animate attributeName="opacity" values="0.15;1;0.15" dur={`${animDur}s`} repeatCount="indefinite" />}
        {animType === 'dash' && <animate attributeName="stroke-dashoffset" from="24" to="0" dur={`${animDur}s`} repeatCount="indefinite" />}
        {isFlow && !isDraw && <animate attributeName="stroke-dashoffset" from="18" to="0" dur={`${animDur}s`} repeatCount="indefinite" />}
      </path>

      {fc && fc.type !== 'none' && (() => {
        const fcSpeed = fc.speed ?? 2
        const fcRepeat = fc.loop ? 'indefinite' : repeatCount
        return fc.type === 'dot'
          ? <FlowDot path={e.path} size={fc.size ?? 6} color={fc.color ?? s.color} dur={fcSpeed} repeat={fcRepeat} />
          : fc.type === 'text'
          ? <FlowText path={e.path} text={fc.text || '●'} size={fc.size ?? 12} color={fc.color ?? s.color} dur={fcSpeed} repeat={fcRepeat} />
          : null
      })()}
    </g>
  )
}

interface EdgeOverlayProps {
  frames: ScreenFrame[]
  crossEdges: WorldEdge[]
  visibleIds: Set<string>
  viewport: { x: number; y: number; zoom: number }
  gRef: React.RefObject<SVGGElement>
  width: number
  height: number
}

function EdgeOverlay({ frames, crossEdges, visibleIds, viewport, gRef, width, height }: EdgeOverlayProps) {
  const allEdges = [...frames.flatMap((f) => f.edges), ...crossEdges]
  const anyVisible = allEdges.some((e) => visibleIds.has(e.id))
  if (!anyVisible) return null

  const z = viewport.zoom

  return (
    <svg style={{ position: 'absolute', inset: 0, width, height, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <defs>
        {allEdges.filter((e) => visibleIds.has(e.id)).map((e) => {
          const s = e.data.style
          if (s.arrowType === 'none' || s.arrowType === 'image') return null
          const ms = (s.markerSize ?? 6) * 1.8
          return (
            <marker key={e.id} id={`pm-${e.id}`} markerWidth={ms} markerHeight={ms} refX={ms - 1.7} refY={ms / 2} orient="auto" markerUnits="userSpaceOnUse">
              {s.arrowType === 'filled-arrow'
                ? <polygon points={`0,0 ${ms},${ms / 2} 0,${ms}`} fill={s.color} />
                : <polyline points={`0,0 ${ms},${ms / 2} 0,${ms}`} stroke={s.color} strokeWidth={1.5} fill="none" />}
            </marker>
          )
        })}
      </defs>

      {/* Single outer <g> with viewport transform — updated via gRef during pan */}
      <g ref={gRef} transform={`translate(${viewport.x},${viewport.y}) scale(${z})`}>
        {/* Per-frame edges (screen-local coords, offset by canvasX/Y) */}
        {frames.map((f) => {
          const vis = f.edges.filter((e) => visibleIds.has(e.id))
          if (!vis.length) return null
          return (
            <g key={f.screenId} transform={`translate(${f.canvasX},${f.canvasY})`}>
              {vis.map((e) => <EdgePathGroup key={e.id} e={e} />)}
            </g>
          )
        })}
        {/* Cross-screen edges (world coords, no extra offset) */}
        {crossEdges.filter((e) => visibleIds.has(e.id)).map((e) => <EdgePathGroup key={e.id} e={e} />)}
      </g>
    </svg>
  )
}

// ── Main player ───────────────────────────────────────────────────────────────

export const AnimationPlayer = memo(({ onClose, hideClose, topOffset = 0 }: { onClose: () => void; hideClose?: boolean; topOffset?: number }) => {
  const nodes = useFlowchartStore(selectNodes)
  const edges = useFlowchartStore(selectEdges)
  const selectedNodeId = useFlowchartStore((s) => s.selectedNodeId)

  const camTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const rfRef = useRef<ReactFlowInstance | null>(null)
  const rafRef = useRef<number | null>(null)  // requestAnimationFrame for viewport sync

  const playerW = window.innerWidth
  const playerH = window.innerHeight - 60 - topOffset

  // ── Build world frames ──────────────────────────────────────────────────────

  const orderedScreenNodes = [...nodes.filter((n) => n.type === 'screen')]
    .sort((a, b) => ((a.data as ScreenData).order ?? 0) - ((b.data as ScreenData).order ?? 0))

  const elFrameMap = new Map<string, number>()
  orderedScreenNodes.forEach((screen, fi) => {
    const sx = screen.position.x
    const sy = screen.position.y
    const sw = screen.width ?? ASPECT_RATIO_SIZES[(screen.data as ScreenData).ratio as keyof typeof ASPECT_RATIO_SIZES]?.w ?? 534
    const sh = screen.height ?? ASPECT_RATIO_SIZES[(screen.data as ScreenData).ratio as keyof typeof ASPECT_RATIO_SIZES]?.h ?? 300
    nodes.forEach((n) => {
      if (n.type !== 'element') return
      if (elFrameMap.has(n.id)) return
      const ew = n.width ?? 120, eh = n.height ?? 50
      const cx = n.position.x + ew / 2, cy = n.position.y + eh / 2
      if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) elFrameMap.set(n.id, fi)
    })
  })

  const frames: ScreenFrame[] = orderedScreenNodes
    .map((n) => ({ ...n, data: n.data as ScreenData }))
    .map((screen, fi) => {
      const screenX = screen.position.x
      const screenY = screen.position.y
      const screenW = screen.width ?? ASPECT_RATIO_SIZES[(screen.data as ScreenData).ratio as keyof typeof ASPECT_RATIO_SIZES]?.w ?? 534
      const screenH = screen.height ?? ASPECT_RATIO_SIZES[(screen.data as ScreenData).ratio as keyof typeof ASPECT_RATIO_SIZES]?.h ?? 300

      const screenElements: WorldElement[] = nodes
        .filter((n) => n.type === 'element' && elFrameMap.get(n.id) === fi)
        .map((n) => ({
          id: n.id,
          data: n.data as ElementData,
          relX: n.position.x - screenX,
          relY: n.position.y - screenY,
          w: n.width ?? 120,
          h: n.height ?? 50,
        }))

      const screenEdges: WorldEdge[] = edges
        .filter((e) => {
          const src = screenElements.find((el) => el.id === e.source)
          const tgt = screenElements.find((el) => el.id === e.target)
          return src && tgt
        })
        .map((e) => {
          const src = screenElements.find((el) => el.id === e.source)!
          const tgt = screenElements.find((el) => el.id === e.target)!
          const sh = e.sourceHandle as string | null | undefined
          const th = e.targetHandle as string | null | undefined
          const [sx2, sy2] = handlePoint(src, sh)
          const [tx2, ty2] = handlePoint(tgt, th)
          const edData = e.data as EdgeData
          // Convert absolute turns to screen-relative coordinates
          const relTurns = edData?.turns?.map((t) => ({ x: t.x - screenX, y: t.y - screenY }))
          return {
            id: e.id,
            data: edData,
            path: buildPath(sx2, sy2, tx2, ty2, edData?.style?.pathType ?? 'bezier', sh, th, edData?.pathOffset, edData?.style?.edgeBorderRadius, relTurns),
            labelX: (sx2 + tx2) / 2,
            labelY: (sy2 + ty2) / 2,
          }
        })

      return {
        screenId: screen.id,
        data: screen.data as ScreenData,
        elements: screenElements,
        edges: screenEdges,
        canvasX: screenX,
        canvasY: screenY,
        canvasW: screenW,
        canvasH: screenH,
      }
    })

  const crossEdges: CrossEdge[] = edges
    .filter((e) => {
      const si = elFrameMap.get(e.source as string)
      const ti = elFrameMap.get(e.target as string)
      return si !== undefined && ti !== undefined && si !== ti
    })
    .map((e) => {
      const si = elFrameMap.get(e.source as string)!
      const ti = elFrameMap.get(e.target as string)!
      const sf = frames[si]
      const tf = frames[ti]
      const srcEl = sf.elements.find((el) => el.id === e.source)!
      const tgtEl = tf.elements.find((el) => el.id === e.target)!
      const sh = e.sourceHandle as string | null | undefined
      const th = e.targetHandle as string | null | undefined
      const [rsx, rsy] = handlePoint(srcEl, sh)
      const [rtx, rty] = handlePoint(tgtEl, th)
      const edData = e.data as EdgeData
      const wsx = sf.canvasX + rsx, wsy = sf.canvasY + rsy
      const wtx = tf.canvasX + rtx, wty = tf.canvasY + rty
      return {
        id: e.id,
        data: edData,
        path: buildPath(wsx, wsy, wtx, wty, edData?.style?.pathType ?? 'bezier', sh, th, edData?.pathOffset, edData?.style?.edgeBorderRadius, edData?.turns),
        srcFrameIdx: si,
        tgtFrameIdx: ti,
        labelX: (wsx + wtx) / 2,
        labelY: (wsy + wty) / 2,
      }
    })

  // ── Starting frame ──────────────────────────────────────────────────────────

  const rfOuter = useReactFlow()

  const initialFrame = (() => {
    if (selectedNodeId) {
      const screenIdx = orderedScreenNodes.findIndex((n) => n.id === selectedNodeId)
      if (screenIdx !== -1) return screenIdx
      const elemFrame = elFrameMap.get(selectedNodeId)
      if (elemFrame !== undefined) return elemFrame
    }
    try {
      const vp = rfOuter.getViewport()
      // Default viewport (no canvas mounted) — start from first frame
      if (vp.x === 0 && vp.y === 0 && vp.zoom === 1) return 0
      const vpCx = (window.innerWidth * 0.5 - vp.x) / vp.zoom
      const vpCy = (window.innerHeight * 0.5 - vp.y) / vp.zoom
      let closest = 0, minDist = Infinity
      orderedScreenNodes.forEach((screen, idx) => {
        const sw = screen.width ?? (ASPECT_RATIO_SIZES[(screen.data as ScreenData).ratio as keyof typeof ASPECT_RATIO_SIZES]?.w ?? 534)
        const sh = screen.height ?? (ASPECT_RATIO_SIZES[(screen.data as ScreenData).ratio as keyof typeof ASPECT_RATIO_SIZES]?.h ?? 300)
        const dist = Math.hypot(screen.position.x + sw / 2 - vpCx, screen.position.y + sh / 2 - vpCy)
        if (dist < minDist) { minDist = dist; closest = idx }
      })
      return closest
    } catch { return 0 }
  })()

  // ── Per-frame zoom — each screen fits the player viewport ──────────────────
  function frameViewport(f: ScreenFrame): { x: number; y: number; zoom: number } {
    const z = Math.min(playerW / f.canvasW, playerH / f.canvasH)
    return {
      x: -(f.canvasX * z) + (playerW - f.canvasW * z) / 2,
      y: -(f.canvasY * z) + (playerH - f.canvasH * z) / 2,
      zoom: z,
    }
  }

  // ── State ────────────────────────────────────────────────────────────────────

  const [currentFrame, setCurrentFrame] = useState(initialFrame)
  const [visitedFrames, setVisitedFrames] = useState<Set<number>>(new Set())
  const [playing, setPlaying] = useState(false)

  const [nodeStates, setNodeStates] = useState<Record<string, NodeAnimState>>(() => {
    const initial: Record<string, NodeAnimState> = {}
    frames.forEach((frame) => {
      frame.elements.forEach((el) => {
        if (el.data.animation.inType !== 'none') initial[el.id] = { hidden: true }
      })
    })
    return initial
  })

  const initialViewport = useMemo(() => {
    const f = frames[initialFrame]
    if (!f) return { x: 0, y: 0, zoom: 1 }
    return frameViewport(f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Viewport state for the edge overlay — only updated AFTER pan completes
  // (during pan, the overlay <g> transform is updated via edgeOverlayRef directly)
  const [currentViewport, setCurrentViewport] = useState(initialViewport)

  // Refs for direct DOM updates during pan animation (no React re-renders)
  const bgSvgRef = useRef<SVGGElement | null>(null)
  const edgeOverlayRef = useRef<SVGGElement | null>(null)

  const [visibleEdgeIds, setVisibleEdgeIds] = useState<Set<string>>(() => {
    // Pre-show edges on the initial frame that have no in-animation
    const initial = new Set<string>()
    const f = frames[initialFrame]
    if (f) {
      f.edges.forEach((e) => {
        if ((e.data.animation?.inType ?? 'none') === 'none') initial.add(e.id)
      })
    }
    return initial
  })

  const playingRef = useRef(playing)
  playingRef.current = playing

  // ── Escape key ──────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !hideClose) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, hideClose])

  // ── Frame activation ─────────────────────────────────────────────────────────

  function activateFrame(frameIdx: number) {
    const frame = frames[frameIdx]
    if (!frame) return

    const outCross = crossEdges.filter((ce) => ce.srcFrameIdx === frameIdx)
    const extEdges = [
      ...frame.edges,
      ...outCross.map((ce) => ({ id: ce.id, data: ce.data, path: ce.path, labelX: 0, labelY: 0 })),
    ]
    const stepMap = buildStepStartMap(frame.elements, extEdges)

    const nodeUpdates: Record<string, NodeAnimState> = {}

    frame.elements.forEach((el) => {
      const inType = el.data.animation.inType
      if (inType === 'none') {
        nodeUpdates[el.id] = { hidden: false }
        return
      }
      const step = el.data.step ?? 1
      const delay = (stepMap.get(step) ?? 0) + (el.data.animation.delay ?? 0)
      const animKey = `${el.id}-${frameIdx}-${Date.now()}`
      const timer = setTimeout(() => {
        setNodeStates((prev) => ({
          ...prev,
          [el.id]: {
            hidden: false,
            animClass: `fc-${inType}`,
            animDuration: el.data.animation.duration ?? 0.4,
            animDelay: 0,
            animKey,
          },
        }))
      }, delay * 1000)
      stepTimersRef.current.push(timer)
    })

    // Schedule edge visibility based on step timing
    const immediateEdgeIds = new Set<string>()
    extEdges.forEach((e) => {
      const inType = e.data.animation?.inType ?? 'none'
      if (inType === 'none') {
        immediateEdgeIds.add(e.id)
        return
      }
      const step = e.data.step ?? 1
      const delay = (stepMap.get(step) ?? 0) + (e.data.animation?.delay ?? 0)
      const timer = setTimeout(() => {
        setVisibleEdgeIds((prev) => { const next = new Set(prev); next.add(e.id); return next })
      }, delay * 1000)
      stepTimersRef.current.push(timer)
    })

    setNodeStates((prev) => ({ ...prev, ...nodeUpdates }))
    setVisibleEdgeIds((prev) => {
      const next = new Set(prev)
      immediateEdgeIds.forEach((id) => next.add(id))
      return next
    })
    setVisitedFrames((prev) => new Set([...prev, frameIdx]))
    setPlaying(true)

    const hold = computeTotalAnimTime({ ...frame, edges: extEdges }) * 1000 + 300
    holdTimerRef.current = setTimeout(() => {
      if (frameIdx < frames.length - 1) {
        goToFrame(frameIdx + 1, true)
      } else {
        setPlaying(false)
      }
    }, hold)
  }

  // ── Frame navigation ─────────────────────────────────────────────────────────

  function goToFrame(frameIdx: number, startPlaying = false) {
    if (camTimerRef.current) clearTimeout(camTimerRef.current)
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    stepTimersRef.current.forEach(clearTimeout)
    stepTimersRef.current = []
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    setCurrentFrame(frameIdx)
    setPlaying(false)

    const frame = frames[frameIdx]
    if (!frame) return

    const vp = frameViewport(frame)
    const isDifferentFrame = frameIdx !== currentFrame
    const panDuration = isDifferentFrame ? 1000 : 0

    // Hide animated elements of the new frame (they'll animate in after pan)
    const nodeUpdates: Record<string, NodeAnimState> = {}
    frame.elements.forEach((el) => {
      nodeUpdates[el.id] = { hidden: el.data.animation.inType !== 'none' }
    })
    setNodeStates((prev) => ({ ...prev, ...nodeUpdates }))

    // Edges stay visible during pan — overlay tracks viewport via ref

    if (panDuration > 0 && rfRef.current) {
      // ── Manual viewport animation: rAF loop with CONSTANT zoom ──
      // No React state updates during animation → no re-renders → no stutter.
      const rf = rfRef.current
      const startVp = rf.getViewport()
      const startTime = performance.now()

      function tick() {
        const elapsed = performance.now() - startTime
        const t = Math.min(elapsed / panDuration, 1)
        const ease = t < 1 ? 1 - Math.pow(1 - t, 3) : 1  // ease-out cubic
        const x = startVp.x + (vp.x - startVp.x) * ease
        const y = startVp.y + (vp.y - startVp.y) * ease
        const z = startVp.zoom + (vp.zoom - startVp.zoom) * ease
        const tfm = `translate(${x},${y}) scale(${z})`

        // Update all three layers via direct DOM — zero React re-renders
        rf.setViewport({ x, y, zoom: z }, { duration: 0 })
        bgSvgRef.current?.setAttribute('transform', tfm)
        edgeOverlayRef.current?.setAttribute('transform', tfm)

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          // Pan complete — sync React state once
          setCurrentViewport(vp)
          onPanComplete()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      // Instant jump (same frame or first load)
      if (rfRef.current) rfRef.current.setViewport(vp, { duration: 0 })
      const tfm = `translate(${vp.x},${vp.y}) scale(${vp.zoom})`
      bgSvgRef.current?.setAttribute('transform', tfm)
      edgeOverlayRef.current?.setAttribute('transform', tfm)
      setCurrentViewport(vp)
      onPanComplete()
    }

    function onPanComplete() {
      if (startPlaying) {
        camTimerRef.current = setTimeout(() => activateFrame(frameIdx), 50)
      } else {
        // Manual nav — reveal everything
        const allVisible: Record<string, NodeAnimState> = {}
        frame.elements.forEach((el) => { allVisible[el.id] = { hidden: false } })
        setNodeStates((prev) => ({ ...prev, ...allVisible }))
        const outCross = crossEdges.filter((ce) => ce.srcFrameIdx === frameIdx || ce.tgtFrameIdx === frameIdx)
        setVisibleEdgeIds(new Set([...frame.edges.map((e) => e.id), ...outCross.map((ce) => ce.id)]))
        setVisitedFrames((prev) => new Set([...prev, frameIdx]))
      }
    }
  }

  function togglePlay() {
    if (!playing) {
      if (currentFrame === frames.length - 1 && visitedFrames.has(frames.length - 1)) {
        setCurrentFrame(0)
        setVisitedFrames(new Set())
        setNodeStates(() => {
          const reset: Record<string, NodeAnimState> = {}
          frames.forEach((frame) => {
            frame.elements.forEach((el) => {
              if (el.data.animation.inType !== 'none') reset[el.id] = { hidden: true }
            })
          })
          return reset
        })
        setVisibleEdgeIds(new Set())
        setTimeout(() => goToFrame(0, true), 50)
      } else {
        goToFrame(currentFrame, true)
      }
    } else {
      setPlaying(false)
      if (camTimerRef.current) clearTimeout(camTimerRef.current)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      stepTimersRef.current.forEach(clearTimeout)
      stepTimersRef.current = []
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (camTimerRef.current) clearTimeout(camTimerRef.current)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      stepTimersRef.current.forEach(clearTimeout)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (frames.length === 0) {
    return (
      <div style={{ position: 'fixed', top: topOffset, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <span style={{ color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>No screens yet.</span>
        {!hideClose && <button onClick={onClose} style={{ padding: '8px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, color: '#475569', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace' }}>Close</button>}
      </div>
    )
  }

  const frame = frames[currentFrame]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', top: topOffset, left: 0, right: 0, bottom: 0, background: '#0f172a', zIndex: 200, display: 'flex', flexDirection: 'column' }}>

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Background fill — extended screen bg rects, synced via ref (no re-renders) */}
        <svg style={{ position: 'absolute', inset: 0, width: playerW, height: playerH, overflow: 'hidden', pointerEvents: 'none' }}>
          <g ref={bgSvgRef} transform={`translate(${initialViewport.x},${initialViewport.y}) scale(${initialViewport.zoom})`}>
            {frames.map((f) => {
              const bg = f.data.backgroundColor || '#ffffff'
              const ext = Math.max(f.canvasW, f.canvasH) * 1.5
              return (
                <rect
                  key={f.screenId}
                  x={f.canvasX - ext}
                  y={f.canvasY - ext}
                  width={f.canvasW + ext * 2}
                  height={f.canvasH + ext * 2}
                  fill={bg}
                />
              )
            })}
          </g>
        </svg>

        <ReactFlowProvider>
          <FlowCanvas
            presentationMode
            presentationNodeStates={nodeStates}
            presentationInitialViewport={initialViewport}
            onRfReady={(rf) => {
              rfRef.current = rf
              rf.setViewport(initialViewport, { duration: 0 })
              setCurrentViewport(initialViewport)
              const tfm = `translate(${initialViewport.x},${initialViewport.y}) scale(${initialViewport.zoom})`
              bgSvgRef.current?.setAttribute('transform', tfm)
              edgeOverlayRef.current?.setAttribute('transform', tfm)
              camTimerRef.current = setTimeout(() => activateFrame(initialFrame), 80)
            }}
          />
        </ReactFlowProvider>

        {/* SVG edge overlay — renders ALL edges above ScreenNode backgrounds */}
        <EdgeOverlay
          frames={frames}
          crossEdges={crossEdges}
          visibleIds={visibleEdgeIds}
          viewport={currentViewport}
          gRef={edgeOverlayRef}
          width={playerW}
          height={playerH}
        />
      </div>

      {/* Controls */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', background: 'rgba(15,23,42,0.95)', borderTop: '1px solid #1e293b', flexShrink: 0, minHeight: 52 }}>
        <CtrlBtn onClick={() => { setPlaying(false); goToFrame(Math.max(0, currentFrame - 1)) }} disabled={currentFrame === 0}>◀</CtrlBtn>

        <button onClick={togglePlay} style={{ padding: '7px 22px', background: '#6366f1', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700 }}>
          {playing ? 'Pause' : (currentFrame === frames.length - 1 && visitedFrames.has(frames.length - 1) ? 'Replay' : 'Play')}
        </button>

        <CtrlBtn onClick={() => { setPlaying(false); goToFrame(Math.min(frames.length - 1, currentFrame + 1)) }} disabled={currentFrame === frames.length - 1}>▶</CtrlBtn>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {frames.map((f, i) => (
            <button
              key={f.screenId + '-' + i}
              onClick={() => { setPlaying(false); goToFrame(i) }}
              title={f.data.label}
              style={{
                width: i === currentFrame ? 22 : 10,
                height: 10,
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                background: i === currentFrame ? '#6366f1' : visitedFrames.has(i) ? '#818cf8' : '#475569',
                transition: 'all .2s',
                padding: 0,
                boxShadow: i === currentFrame ? '0 0 0 2px #6366f140' : 'none',
              }}
            />
          ))}
        </div>

        <span style={{ color: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}>
          {frame?.data.label} ({currentFrame + 1}/{frames.length})
        </span>

        {!hideClose && <button onClick={onClose} style={{ marginLeft: 8, padding: '6px 14px', background: 'transparent', border: '1px solid #334155', borderRadius: 5, color: '#64748b', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
          Close
        </button>}
      </div>
    </div>
  )
})

AnimationPlayer.displayName = 'AnimationPlayer'

function CtrlBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #334155', borderRadius: 5, color: disabled ? '#334155' : '#94a3b8', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
      {children}
    </button>
  )
}
