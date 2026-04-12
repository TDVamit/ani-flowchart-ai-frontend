import { memo, useCallback } from 'react'
import {
  EdgeProps,
  getBezierPath,
  getStraightPath,
  EdgeLabelRenderer,
  BaseEdge,
  useViewport,
  Position,
} from '@xyflow/react'
import type { EdgeData } from '../../../types/flowchart'
import { useFlowchartStore } from '../../../store/useFlowchartStore'
import { usePresentationContext } from '../PresentationContext'

// ── Step-path routing ────────────────────────────────────────────────────────

const STEP_GAP = 25

/** Compute default turn points for a step path given source/target + handle directions. */
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
    // Facing each other with room → 3 segments (H, V, H)
    if (sDir !== tDir && sDir * (tEdge - sEdge) > 0) {
      const mx = (sx + tx) / 2
      return [{ x: mx, y: sy }, { x: mx, y: ty }]
    }
    // Same direction → route around
    if (sDir === tDir) {
      const ex = sDir === 1 ? Math.max(sEdge, tEdge) : Math.min(sEdge, tEdge)
      return [{ x: ex, y: sy }, { x: ex, y: ty }]
    }
    // Facing each other but overlapping → 5 segments
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

  // Mixed: H ↔ V
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

/** Keep stored turns aligned with current source/target so segments stay H/V.
 *  Uses alternating direction propagation from both source and target so that
 *  every segment is strictly horizontal or vertical (perfect 90° bends). */
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

  // Lock first turn to source exit axis
  if (srcH) out[0].y = sy
  else      out[0].x = sx
  // Lock last turn to target entry axis
  if (tgtH) out[last].y = ty
  else      out[last].x = tx

  if (last < 1) return out

  // Split at midpoint: forward pass handles source half, backward handles target half.
  // Each pass propagates alternating H/V constraints so every segment is 90°.
  const mid = Math.floor(last / 2)

  // Forward pass from source (turn 1 .. mid)
  // Segment source→turn[0] has direction srcH,
  // segment turn[0]→turn[1] alternates, etc.
  let segH = srcH
  for (let i = 1; i <= mid; i++) {
    segH = !segH
    if (segH) out[i].y = out[i - 1].y   // H segment: same Y
    else      out[i].x = out[i - 1].x   // V segment: same X
  }

  // Backward pass from target (turn last-1 .. mid+1)
  // Segment turn[last]→target has direction tgtH,
  // segment turn[last-1]→turn[last] alternates, etc.
  segH = tgtH
  for (let i = last - 1; i > mid; i--) {
    segH = !segH
    if (segH) out[i].y = out[i + 1].y
    else      out[i].x = out[i + 1].x
  }

  return out
}

/** Build SVG path string from source → turns → target, with optional rounded corners. */
function buildStepPathFromTurns(
  sx: number, sy: number,
  tx: number, ty: number,
  turns: Array<{ x: number; y: number }>,
  br: number,
): string {
  const pts = [{ x: sx, y: sy }, ...turns, { x: tx, y: ty }]
  let d = `M ${pts[0].x} ${pts[0].y}`

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]

    if (i < pts.length - 1 && br > 0) {
      const next = pts[i + 1]
      const d1x = Math.sign(cur.x - prev.x) || 0
      const d1y = Math.sign(cur.y - prev.y) || 0
      const d2x = Math.sign(next.x - cur.x) || 0
      const d2y = Math.sign(next.y - cur.y) || 0

      // Only round if there's an actual direction change
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

/** Compute draggable handles for each adjustable segment. */
interface SegHandle {
  x: number; y: number
  axis: 'x' | 'y'
  adjustments: Array<{ turnIdx: number; coord: 'x' | 'y' }>
}

function getSegmentHandles(
  sx: number, sy: number,
  tx: number, ty: number,
  turns: Array<{ x: number; y: number }>,
): SegHandle[] {
  const pts = [{ x: sx, y: sy }, ...turns, { x: tx, y: ty }]
  const handles: SegHandle[] = []

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    if (len < 8) continue

    const isH = Math.abs(a.y - b.y) < 1
    const isV = Math.abs(a.x - b.x) < 1
    if (!isH && !isV) continue

    // Which turns define this segment? pts[i] = turns[i-1], pts[i+1] = turns[i]
    const adjustments: Array<{ turnIdx: number; coord: 'x' | 'y' }> = []
    const coord: 'x' | 'y' = isH ? 'y' : 'x'
    const turnA = i - 1
    const turnB = i
    if (turnA >= 0 && turnA < turns.length) adjustments.push({ turnIdx: turnA, coord })
    if (turnB >= 0 && turnB < turns.length) adjustments.push({ turnIdx: turnB, coord })

    if (adjustments.length === 0) continue

    handles.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      axis: isH ? 'y' : 'x',
      adjustments,
    })
  }
  return handles
}

// ── Edge component ───────────────────────────────────────────────────────────

export const AnimatedEdge = memo((props: EdgeProps) => {
  const {
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data: rawData, selected,
  } = props

  const data = rawData as EdgeData | undefined
  if (!data) return null

  const { updateEdge } = useFlowchartStore()
  const { zoom } = useViewport()
  const { presentationMode, showSteps } = usePresentationContext()

  const { style, animation, label, edgeKind } = data
  const pathType   = style?.pathType   ?? 'bezier'
  const color      = selected ? '#6366f1' : (style?.color ?? '#6366f1')
  const strokeW    = style?.strokeWidth ?? 2
  const lineType   = style?.lineType    ?? 'solid'
  const arrowType      = style?.arrowType      ?? 'filled-arrow'
  const customArrowUrl = style?.customArrowUrl
  const animType   = animation?.type    ?? 'none'
  const markerSize = style?.markerSize  ?? 6
  const flowContent = animation?.flowContent

  const isStepPath = pathType === 'step' || pathType === 'smoothstep'
  const br = pathType === 'smoothstep' ? (style?.edgeBorderRadius ?? 10) : (style?.edgeBorderRadius ?? 0)

  // ── Compute turns and path ──────────────────────────────────────────────────
  const defaultTurns = isStepPath
    ? computeDefaultTurns(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition)
    : []
  // When stored turns exist, align first/last with current source/target so segments stay H/V
  const activeTurns = (isStepPath && data.turns)
    ? alignTurns(data.turns, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition)
    : defaultTurns

  let edgePath: string
  let labelX: number
  let labelY: number

  if (pathType === 'straight') {
    ;[edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  } else if (isStepPath) {
    // Always use our own path builder so handles and path are in sync
    edgePath = buildStepPathFromTurns(sourceX, sourceY, targetX, targetY, activeTurns, br)
    const midIdx = Math.floor(activeTurns.length / 2)
    labelX = activeTurns[midIdx]?.x ?? (sourceX + targetX) / 2
    labelY = activeTurns[midIdx]?.y ?? (sourceY + targetY) / 2
  } else {
    ;[edgePath, labelX, labelY] = getBezierPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
    })
  }

  // Segment handles (always computed from active turns for handle placement)
  const segHandles = isStepPath
    ? getSegmentHandles(sourceX, sourceY, targetX, targetY, activeTurns)
    : []

  const strokeDash =
    lineType === 'dashed' ? '8 4' :
    lineType === 'dotted' ? '2 4' :
    undefined

  const opacity  = edgeKind === 'screen' ? 0.3 : 1
  const markerId = `arrow-${id}`
  const animClass =
    animType === 'flow'  ? 'edge-flow'  :
    animType === 'pulse' ? 'edge-pulse' :
    animType === 'dash'  ? 'edge-dash'  :
    ''

  const showFlowContent = flowContent && flowContent.type !== 'none'
  const edgeLoopAttr = animation?.loop === 'infinite' ? 'indefinite'
    : animation?.loop === 'finite' ? `${animation.loopCount}`
    : '1'
  const loopAttr = flowContent?.loop ? 'indefinite' : edgeLoopAttr
  const fcSpeed = flowContent?.speed ?? 2

  // ── Handle drag for segment control ──────────────────────────────────────────
  const handleSegDrag = useCallback((handle: SegHandle, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    // Initialise turns from stored or defaults
    const baseTurns = (data!.turns ?? defaultTurns).map((t) => ({ ...t }))
    let adjustments = handle.adjustments

    // ── Auto-inject kickout turns for locked first/last segments ──────────
    // The first segment (source→turn[0]) has its perpendicular coord locked
    // by alignTurns — dragging it would be a no-op. Injecting 2 turns at the
    // start creates a detour section with a freely movable middle segment.
    // Same logic applies to the last segment (turn[last]→target).
    const srcH = sourcePosition === Position.Right || sourcePosition === Position.Left
    const tgtH = targetPosition === Position.Right || targetPosition === Position.Left

    if (adjustments.length === 1 && adjustments[0].turnIdx === 0) {
      const lockedCoord: 'x' | 'y' = srcH ? 'y' : 'x'
      if (adjustments[0].coord === lockedCoord) {
        // Only inject if first turn is far enough from source (no existing kickout)
        const dist = srcH
          ? Math.abs(baseTurns[0].x - sourceX)
          : Math.abs(baseTurns[0].y - sourceY)
        if (dist > STEP_GAP * 1.5) {
          const sDir = (sourcePosition === Position.Right || sourcePosition === Position.Bottom) ? 1 : -1
          const kick = srcH
            ? { x: sourceX + sDir * STEP_GAP, y: sourceY }
            : { x: sourceX, y: sourceY + sDir * STEP_GAP }
          // Insert kick (locked first turn) and bridge (movable) at the start
          baseTurns.unshift({ ...kick }, { ...kick })
          // Move bridge (turn[1]) AND the next turn (turn[2], the old turn[0])
          // so bridge→turn[2] stays H/V (90° bends)
          adjustments = [
            { turnIdx: 1, coord: lockedCoord },
            { turnIdx: 2, coord: lockedCoord },
          ]
        }
      }
    }

    const lastIdx = baseTurns.length - 1
    if (adjustments.length === 1 && adjustments[0].turnIdx === lastIdx && lastIdx >= 0) {
      const lockedCoord: 'x' | 'y' = tgtH ? 'y' : 'x'
      if (adjustments[0].coord === lockedCoord) {
        const dist = tgtH
          ? Math.abs(baseTurns[lastIdx].x - targetX)
          : Math.abs(baseTurns[lastIdx].y - targetY)
        if (dist > STEP_GAP * 1.5) {
          const tDir = (targetPosition === Position.Right || targetPosition === Position.Bottom) ? 1 : -1
          const kick = tgtH
            ? { x: targetX + tDir * STEP_GAP, y: targetY }
            : { x: targetX, y: targetY + tDir * STEP_GAP }
          // Append bridge (movable) and kick (locked last turn) at the end
          baseTurns.push({ ...kick }, { ...kick })
          // Move bridge (second-to-last) AND the previous turn (old last turn)
          // so old_last→bridge stays H/V (90° bends)
          const bridgeIdx = baseTurns.length - 2
          adjustments = [
            { turnIdx: lastIdx, coord: lockedCoord },
            { turnIdx: bridgeIdx, coord: lockedCoord },
          ]
        }
      }
    }

    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / zoom
      const dy = (ev.clientY - startY) / zoom
      const newTurns = baseTurns.map((t) => ({ ...t }))
      for (const adj of adjustments) {
        if (adj.coord === 'x') newTurns[adj.turnIdx].x = baseTurns[adj.turnIdx].x + dx
        else newTurns[adj.turnIdx].y = baseTurns[adj.turnIdx].y + dy
      }
      updateEdge(id, { turns: newTurns })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [id, data, defaultTurns, zoom, updateEdge, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition])

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="5" refY="5"
          markerWidth={markerSize}
          markerHeight={markerSize}
          orient="auto-start-reverse"
        >
          {arrowType === 'filled-arrow' && <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />}
          {arrowType === 'open-arrow'   && <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke={color} strokeWidth="2" />}
          {arrowType === 'image' && customArrowUrl && (
            <image href={customArrowUrl} x="0" y="0" width="10" height="10" preserveAspectRatio="xMidYMid meet" />
          )}
        </marker>
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke:          color,
          strokeWidth:     selected ? strokeW + 1 : strokeW,
          strokeDasharray: strokeDash,
          opacity,
          markerEnd:       arrowType !== 'none' && (arrowType !== 'image' || customArrowUrl) ? `url(#${markerId})` : undefined,
        }}
        className={animClass}
        interactionWidth={20}
      />

      {/* Flow content animation */}
      {showFlowContent && (
        <svg style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
          <path id={`path-${id}`} d={edgePath} fill="none" stroke="none" />
          {flowContent.type === 'dot' && (
            <circle r={flowContent.size / 2} fill={flowContent.color}>
              <animateMotion dur={`${fcSpeed}s`} repeatCount={loopAttr} rotate="auto">
                <mpath href={`#path-${id}`} />
              </animateMotion>
            </circle>
          )}
          {flowContent.type === 'text' && (
            <text
              fontSize={flowContent.size}
              fill={flowContent.color}
              stroke="white"
              strokeWidth={Math.max(2, flowContent.size * 0.35)}
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ paintOrder: 'stroke fill' }}
            >
              {flowContent.text || '●'}
              <animateMotion dur={`${fcSpeed}s`} repeatCount={loopAttr}>
                <mpath href={`#path-${id}`} />
              </animateMotion>
            </text>
          )}
          {flowContent.type === 'icon' && flowContent.iconUrl && (
            <image
              href={flowContent.iconUrl}
              width={flowContent.size}
              height={flowContent.size}
              x={-flowContent.size / 2}
              y={-flowContent.size / 2}
            >
              <animateMotion dur={`${fcSpeed}s`} repeatCount={loopAttr} rotate="auto">
                <mpath href={`#path-${id}`} />
              </animateMotion>
            </image>
          )}
        </svg>
      )}

      {(label || (data.step !== undefined && !presentationMode && showSteps)) && (
        <EdgeLabelRenderer>
          <div style={{
            position:        'absolute',
            transform:       `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents:   'all',
            display:         'flex',
            alignItems:      'center',
            gap:             4,
            zIndex:          1000,
          }}>
            {data.step !== undefined && !presentationMode && showSteps && (
              <div style={{
                width: 18, height: 18,
                borderRadius: '50%',
                background: color,
                color: '#fff',
                fontSize: 9,
                fontFamily: 'IBM Plex Mono, monospace',
                fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${color}40, 0 2px 4px #00000030`,
              }}>
                {data.step}
              </div>
            )}
            {label && (
              <div style={{
                backgroundColor: '#fff',
                border:          `1px solid ${color}`,
                borderRadius:    4,
                padding:         '1px 7px',
                fontSize:        10,
                color:           '#1e293b',
                fontFamily:      'IBM Plex Mono, monospace',
                whiteSpace:      'nowrap',
                boxShadow:       '0 1px 4px #00000018',
              }}>
                {label}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Segment drag handles for step/smoothstep — one per adjustable segment */}
      {selected && isStepPath && !presentationMode && segHandles.length > 0 && (
        <EdgeLabelRenderer>
          {segHandles.map((h, i) => (
            <div
              key={i}
              onPointerDown={(e) => handleSegDrag(h, e)}
              title="Drag to adjust segment"
              style={{
                position:     'absolute',
                transform:    `translate(-50%, -50%) translate(${h.x}px, ${h.y}px)`,
                width:         h.axis === 'x' ? 8 : 18,
                height:        h.axis === 'x' ? 18 : 8,
                borderRadius:  3,
                background:    '#fff',
                border:        `2px solid ${color}`,
                cursor:        h.axis === 'x' ? 'ew-resize' : 'ns-resize',
                pointerEvents: 'all',
                zIndex:         10,
                boxShadow:     '0 0 0 3px #6366f120',
              }}
            />
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  )
})

AnimatedEdge.displayName = 'AnimatedEdge'
