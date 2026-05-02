import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NodeProps, Handle, Position, NodeResizer, ReactFlow, ReactFlowProvider, ConnectionMode } from '@xyflow/react'
import type { NodeTypes, EdgeTypes } from '@xyflow/react'
import type { ElementData, ScreenData, PremadeLayout, TextPosition, AspectRatio } from '../../../types/flowchart'
import { ASPECT_RATIO_SIZES } from '../../../types/flowchart'
import { useFlowchartStore, selectNodes, selectEdges, edgesForNodes } from '../../../store/useFlowchartStore'

import { usePresentationContext, PresentationContext } from '../PresentationContext'
import { ScreenNode } from './ScreenNode'
import { AnimatedEdge } from '../edges/AnimatedEdge'
import * as LucideIcons from 'lucide-react'

// ── Lightweight inline markdown renderer ─────────────────────────────────────
// Supports: - bullets, **bold**, *italic*, `code`, # headings, numbered lists

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Unordered list: "- item" or "* item"
    if (/^[\-\*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\-\*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*]\s+/, ''))
        i++
      }
      result.push(
        <ul key={`ul-${i}`} style={{ margin: 0, paddingLeft: '1.2em', listStyleType: 'disc', textAlign: 'left' }}>
          {items.map((item, j) => <li key={j} style={{ marginBottom: 1 }}>{inlineMarkdown(item)}</li>)}
        </ul>
      )
      continue
    }

    // Ordered list: "1. item"
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      result.push(
        <ol key={`ol-${i}`} style={{ margin: 0, paddingLeft: '1.4em', textAlign: 'left' }}>
          {items.map((item, j) => <li key={j} style={{ marginBottom: 1 }}>{inlineMarkdown(item)}</li>)}
        </ol>
      )
      continue
    }

    // Heading: # ## ###
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const sizes = [1.3, 1.15, 1] as const
      result.push(
        <div key={`h-${i}`} style={{ fontWeight: 700, fontSize: `${sizes[level - 1]}em`, marginBottom: 2 }}>
          {inlineMarkdown(headingMatch[2])}
        </div>
      )
      i++
      continue
    }

    // Regular line
    if (line.trim() === '') {
      result.push(<div key={`br-${i}`} style={{ height: '0.4em' }} />)
    } else {
      result.push(<div key={`p-${i}`}>{inlineMarkdown(line)}</div>)
    }
    i++
  }

  return <>{result}</>
}

function inlineMarkdown(text: string): React.ReactNode {
  // Split on inline patterns: **bold**, *italic*, `code`
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[2]) parts.push(<strong key={key++}>{match[2]}</strong>)
    else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>)
    else if (match[4]) parts.push(<code key={key++} style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 3, padding: '0 3px', fontSize: '0.9em' }}>{match[4]}</code>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

// ── lord-icon web component (loaded via CDN script in index.html) ─────────────
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        trigger?: string
        delay?: string | number
        colors?: string
      }
    }
  }
}

export function LordIcon({
  url, size,
  primary = '#000000', secondary = '#6366f1', delay = 500,
}: { url: string; size: number; primary?: string; secondary?: string; delay?: number }) {
  if (!url) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, opacity: 0.4 }}>✦</div>
  return (
    <lord-icon
      src={url}
      trigger="loop"
      delay={delay}
      colors={`primary:${primary},secondary:${secondary}`}
      style={{ width: size, height: size }}
    />
  )
}

// ── Premade SVG animations ────────────────────────────────────────────────────

export function PremadeSVG({ type, size, color = '#6366f1', lottieUrl, lottiePrimary, lottieSecondary, lottieDelay }: { type: string; size: number; color?: string; lottieUrl?: string; lottiePrimary?: string; lottieSecondary?: string; lottieDelay?: number }) {
  const s = size * 0.5

  switch (type) {
    case 'processing':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={8 + i * 12}
              cy={20}
              r={5}
              fill={color}
              style={{
                animation: `pm-pulse 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </svg>
      )
    case 'building':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          {[0, 1, 2].map((i) => {
            const maxH = 10 + i * 10
            return (
              <rect
                key={i}
                x={4 + i * 12}
                y={40 - maxH}
                width={9}
                height={maxH}
                fill={color}
                style={{
                  animation: `pm-bar 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                  transformOrigin: `${8 + i * 12}px 40px`,
                }}
              />
            )
          })}
        </svg>
      )
    case 'writing':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <rect x={4} y={8} width={24} height={3} rx={1} fill="#94a3b8" />
          <rect x={4} y={15} width={20} height={3} rx={1} fill="#94a3b8" />
          <rect x={4} y={22} width={16} height={3} rx={1} fill="#94a3b8" />
          <rect
            x={28}
            y={8}
            width={2}
            height={18}
            rx={1}
            fill={color}
            style={{ animation: 'pm-blink 0.8s step-end infinite' }}
          />
        </svg>
      )
    case 'loading':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <rect x={4} y={17} width={32} height={6} rx={3} fill="#e2e8f0" />
          <rect
            x={4}
            y={17}
            width={32}
            height={6}
            rx={3}
            fill={color}
            style={{ animation: 'pm-sweep 1.4s ease-in-out infinite' }}
          />
        </svg>
      )
    case 'checking':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={16} fill="none" stroke="#e2e8f0" strokeWidth={3} />
          <polyline
            points="12,20 18,26 28,14"
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'pm-check 1s ease forwards' }}
          />
        </svg>
      )
    case 'sending':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <path
            d="M6,20 L28,20 M22,14 L28,20 L22,26"
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'pm-slide-r 1s ease-in-out infinite' }}
          />
        </svg>
      )
    case 'thinking':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={10 + i * 10}
              cy={20}
              r={4}
              fill={color}
              style={{
                animation: 'pm-pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.25}s`,
              }}
            />
          ))}
        </svg>
      )
    case 'uploading':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <path
            d="M20,28 L20,12 M14,18 L20,12 L26,18"
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'pm-slide-u 1s ease-in-out infinite' }}
          />
          <line x1={10} y1={30} x2={30} y2={30} stroke={color} strokeWidth={3} strokeLinecap="round" />
        </svg>
      )
    case 'success':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={16} fill="none" stroke="#22c55e" strokeWidth={3} />
          <polyline points="12,20 18,26 28,14" fill="none" stroke="#22c55e" strokeWidth={3}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: 'pm-check 1s ease forwards' }} />
        </svg>
      )
    case 'error':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={16} fill="none" stroke="#ef4444" strokeWidth={3} />
          <g style={{ animation: 'pm-blink 1.2s step-end infinite' }}>
            <line x1={14} y1={14} x2={26} y2={26} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
            <line x1={26} y1={14} x2={14} y2={26} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
          </g>
        </svg>
      )
    case 'warning':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <polygon points="20,4 36,34 4,34" fill="none" stroke="#f59e0b" strokeWidth={3} strokeLinejoin="round" />
          <line x1={20} y1={15} x2={20} y2={24} stroke="#f59e0b" strokeWidth={3} strokeLinecap="round"
            style={{ animation: 'pm-blink 0.9s step-end infinite' }} />
          <circle cx={20} cy={29} r={2} fill="#f59e0b" />
        </svg>
      )
    case 'waiting':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={15} fill="none" stroke="#e2e8f0" strokeWidth={3} />
          <path d="M 20,5 A 15,15 0 0,1 35,20" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
            style={{ animation: 'pm-spin 1s linear infinite', transformOrigin: '20px 20px' }} />
        </svg>
      )
    case 'syncing':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <g style={{ animation: 'pm-spin 1.2s linear infinite', transformOrigin: '20px 20px' }}>
            <path d="M 8,20 A 12,12 0 0,1 32,20" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
            <path d="M 32,20 A 12,12 0 0,1 8,20" fill="none" stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
          </g>
        </svg>
      )
    case 'downloading':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <path d="M20,8 L20,26 M14,20 L20,26 L26,20"
            fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: 'pm-slide-d 1s ease-in-out infinite' }} />
          <line x1={10} y1={33} x2={30} y2={33} stroke={color} strokeWidth={3} strokeLinecap="round" />
        </svg>
      )
    case 'scanning':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <rect x={4} y={4} width={32} height={32} rx={3} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
          <line x1={4} y1={20} x2={36} y2={20} stroke={color} strokeWidth={2}
            style={{ animation: 'pm-scan 1.4s ease-in-out infinite', transformOrigin: '20px 20px' }} />
          <line x1={4} y1={20} x2={36} y2={20} stroke="#6366f133" strokeWidth={6}
            style={{ animation: 'pm-scan 1.4s ease-in-out infinite', transformOrigin: '20px 20px' }} />
        </svg>
      )
    case 'typing':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <path d="M4,8 Q4,4 8,4 L32,4 Q36,4 36,8 L36,24 Q36,28 32,28 L22,28 L16,35 L16,28 L8,28 Q4,28 4,24 Z"
            fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} />
          {([0, 1, 2] as const).map((i) => (
            <circle key={i} cx={14 + i * 6} cy={16} r={2.5} fill={color}
              style={{ animation: 'pm-pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
          ))}
        </svg>
      )
    case 'broadcasting':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={4} fill={color} />
          {([9, 14, 19] as const).map((r, i) => (
            <circle key={r} cx={20} cy={20} r={r} fill="none" stroke={color} strokeWidth={1.5}
              style={{ animation: 'pm-pulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.35}s` }} />
          ))}
        </svg>
      )
    case 'recording':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={16} fill="none" stroke="#ef4444" strokeWidth={2} opacity={0.3} />
          <circle cx={20} cy={20} r={9} fill="#ef4444"
            style={{ animation: 'pm-blink 1s ease-in-out infinite' }} />
        </svg>
      )
    case 'streaming':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          {([0, 1, 2, 3, 4] as const).map((i) => {
            const maxH = [10, 18, 26, 18, 10][i]
            const x = 4 + i * 7
            return (
              <rect key={i} x={x} y={20 - maxH / 2} width={5} height={maxH} rx={2} fill={color}
                style={{
                  animation: 'pm-bar 1s ease-in-out infinite',
                  animationDelay: `${i * 0.1}s`,
                  transformOrigin: `${x + 2.5}px 20px`,
                }} />
            )
          })}
        </svg>
      )
    case 'connecting':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={8} cy={20} r={5} fill={color} />
          <circle cx={32} cy={20} r={5} fill={color} />
          <line x1={13} y1={20} x2={27} y2={20} stroke={color} strokeWidth={2.5}
            style={{ animation: 'pm-sweep 1.2s ease-in-out infinite' }} />
        </svg>
      )
    case 'api':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <path d="M4,14 L30,14 M24,8 L30,14 L24,20" fill="none" stroke={color} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: 'pm-slide-r 1.2s ease-in-out infinite' }} />
          <path d="M36,26 L10,26 M16,20 L10,26 L16,32" fill="none" stroke={color} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: 'pm-slide-l 1.2s ease-in-out infinite', animationDelay: '0.6s' }} />
        </svg>
      )
    case 'database':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <ellipse cx={20} cy={11} rx={14} ry={5} fill="none" stroke={color} strokeWidth={2}
            style={{ animation: 'pm-pulse 1.6s ease-in-out infinite' }} />
          <line x1={6} y1={11} x2={6} y2={29} stroke={color} strokeWidth={2} />
          <line x1={34} y1={11} x2={34} y2={29} stroke={color} strokeWidth={2} />
          <ellipse cx={20} cy={29} rx={14} ry={5} fill="none" stroke={color} strokeWidth={2} />
          <ellipse cx={20} cy={20} rx={14} ry={5} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
        </svg>
      )
    case 'server':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          {([4, 15, 26] as const).map((y, i) => (
            <g key={y}>
              <rect x={4} y={y} width={32} height={9} rx={2} fill="none" stroke={color} strokeWidth={1.5} />
              <circle cx={11} cy={y + 4.5} r={2} fill={color}
                style={{ animation: 'pm-blink 1.4s step-end infinite', animationDelay: `${i * 0.25}s` }} />
              <rect x={17} y={y + 2.5} width={12} height={4} rx={1} fill={color} opacity={0.3} />
            </g>
          ))}
        </svg>
      )
    case 'user':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={20} cy={13} r={7} fill="none" stroke={color} strokeWidth={2}
            style={{ animation: 'pm-pulse 1.5s ease-in-out infinite' }} />
          <path d="M6,36 Q6,25 20,25 Q34,25 34,36" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </svg>
      )
    case 'clock':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={16} fill="none" stroke={color} strokeWidth={2} />
          <line x1={20} y1={20} x2={20} y2={8} stroke={color} strokeWidth={2.5} strokeLinecap="round"
            style={{ animation: 'pm-spin 3s linear infinite', transformOrigin: '20px 20px' }} />
          <line x1={20} y1={20} x2={29} y2={20} stroke={color} strokeWidth={2} strokeLinecap="round"
            style={{ animation: 'pm-spin 36s linear infinite', transformOrigin: '20px 20px' }} />
          <circle cx={20} cy={20} r={2.5} fill={color} />
        </svg>
      )
    case 'sparkle':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          {([
            { cx: 20, cy: 20, r: 4, d: '0s' },
            { cx: 10, cy: 13, r: 2.5, d: '0.3s' },
            { cx: 30, cy: 11, r: 2, d: '0.5s' },
            { cx: 8,  cy: 28, r: 1.5, d: '0.7s' },
            { cx: 32, cy: 27, r: 2.5, d: '0.2s' },
            { cx: 24, cy: 32, r: 1.5, d: '0.9s' },
          ] as const).map((dot, i) => (
            <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} fill={color}
              style={{ animation: 'pm-blink 1.4s ease-in-out infinite', animationDelay: dot.d }} />
          ))}
        </svg>
      )
    case 'fire':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <path d="M20,36 Q8,36 8,24 Q8,16 14,12 Q14,20 18,18 Q16,10 20,4 Q24,10 24,18 Q28,14 28,10 Q34,16 32,26 Q30,34 20,36 Z"
            fill={color} opacity={0.6}
            style={{ animation: 'pm-pulse 0.9s ease-in-out infinite' }} />
          <path d="M20,32 Q14,32 14,24 Q14,20 18,18 Q18,23 20,22 Q22,18 22,22 Q26,20 26,26 Q26,32 20,32 Z"
            fill={color}
            style={{ animation: 'pm-pulse 0.9s ease-in-out infinite', animationDelay: '0.15s' }} />
        </svg>
      )
    case 'shield':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <path d="M20,4 L34,10 L34,22 Q34,32 20,38 Q6,32 6,22 L6,10 Z"
            fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
          <polyline points="14,20 18,24 26,16" fill="none" stroke={color} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: 'pm-check 1.2s ease forwards' }} />
        </svg>
      )
    case 'lock':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <rect x={8} y={20} width={24} height={16} rx={3} fill="none" stroke={color} strokeWidth={2.5} />
          <path d="M13,20 L13,14 Q13,6 20,6 Q27,6 27,14 L27,20"
            fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round"
            style={{ animation: 'pm-blink 1.6s ease-in-out infinite' }} />
          <circle cx={20} cy={28} r={3} fill={color} />
        </svg>
      )
    case 'refresh':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <g style={{ animation: 'pm-spin 1.2s linear infinite', transformOrigin: '20px 20px' }}>
            <path d="M 20,6 A 14,14 0 1,1 6,20" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
            <polygon points="20,2 26,10 14,10" fill={color} />
          </g>
        </svg>
      )
    default: {
      if (type.startsWith('lottie-')) {
        return <LordIcon url={lottieUrl ?? ''} size={s} primary={lottiePrimary} secondary={lottieSecondary} delay={lottieDelay} />
      }
      if (type.startsWith('lucide-')) {
        const iconKey = type.slice(7).split('-').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IconComp = (LucideIcons as any)[iconKey] as React.ComponentType<{ size: number; color: string }> | undefined
        if (IconComp) {
          const spinIcons   = ['Settings','Settings2','RefreshCw','RefreshCcw','RotateCw','RotateCcw','Globe','Globe2','Loader','Loader2','Aperture','GitBranch']
          const shakeIcons  = ['Bell','BellRing','BellDot','Phone','PhoneCall','PhoneIncoming','Vibrate','AlarmClock']
          const heartIcons  = ['Heart','HeartPulse','Activity','Pulse','HeartHandshake']
          const blinkIcons  = ['Zap','ZapOff','AlertTriangle','AlertOctagon','Bolt','FlashlightOff']
          const pulseIcons  = ['Wifi','Cpu','Server','Database','Radio','Bluetooth','Signal','Rss','Broadcast']
          const slideIcons  = ['Mail','Send','SendHorizontal','ArrowRight','MoveRight','Forward','Navigation']
          let anim = 'pm-float 2s ease-in-out infinite'
          if (spinIcons.includes(iconKey))  anim = 'pm-spin 2.5s linear infinite'
          else if (shakeIcons.includes(iconKey))  anim = 'pm-shake 1s ease-in-out infinite'
          else if (heartIcons.includes(iconKey))  anim = 'pm-heartbeat 1.2s ease-in-out infinite'
          else if (blinkIcons.includes(iconKey))  anim = 'pm-blink 0.8s ease-in-out infinite'
          else if (pulseIcons.includes(iconKey))  anim = 'pm-pulse 1.4s ease-in-out infinite'
          else if (slideIcons.includes(iconKey))  anim = 'pm-slide-r 1.2s ease-in-out infinite'
          return <div style={{ display: 'inline-flex', animation: anim }}><IconComp size={s} color={color} /></div>
        }
      }
      return <span style={{ fontSize: s * 0.5 }}>◆</span>
    }
  }
}

// ── Shape SVG ─────────────────────────────────────────────────────────────────

export function ShapeSVG({ shape, color, borderColor, borderWidth, style }: {
  shape: string; color: string; borderColor: string; borderWidth: number
  style?: React.CSSProperties
}) {
  const sw = borderWidth
  const svgStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    ...style,
  }

  switch (shape) {
    case 'circle':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <ellipse cx="50" cy="50" rx={48 - sw} ry={48 - sw} fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'diamond':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon points="50,4 96,50 50,96 4,50" fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'parallelogram':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon points="20,4 100,4 80,96 0,96" fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'hexagon':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon points="50,4 93,25 93,75 50,96 7,75 7,25" fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'cylinder':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <rect x="4" y="20" width="92" height="68" fill={color} stroke={borderColor} strokeWidth={sw} />
          <ellipse cx="50" cy="20" rx="46" ry="14" fill={color} stroke={borderColor} strokeWidth={sw} />
          <ellipse cx="50" cy="88" rx="46" ry="14" fill={color} stroke="none" />
          <path d="M4,20 Q50,34 96,20" fill="none" stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'document':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M4,4 L96,4 L96,82 Q70,72 50,82 Q30,92 4,82 Z" fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'triangle':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon points="50,4 96,96 4,96" fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'star':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon
            points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35"
            fill={color} stroke={borderColor} strokeWidth={sw}
          />
        </svg>
      )
    case 'cross':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M35,4 L65,4 L65,35 L96,35 L96,65 L65,65 L65,96 L35,96 L35,65 L4,65 L4,35 L35,35 Z"
            fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'arrow-right':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon points="4,30 60,30 60,10 96,50 60,90 60,70 4,70" fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'cloud':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M25,70 Q4,70 4,52 Q4,36 18,34 Q18,12 38,12 Q50,12 56,22 Q62,16 72,18 Q88,18 88,36 Q96,38 96,52 Q96,70 75,70 Z"
            fill={color} stroke={borderColor} strokeWidth={sw} />
        </svg>
      )
    case 'tag':
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M4,4 L72,4 L96,50 L72,96 L4,96 Z" fill={color} stroke={borderColor} strokeWidth={sw} />
          <circle cx="22" cy="50" r="7" fill={borderColor} />
        </svg>
      )
    default:
      return null
  }
}

// ── Step badge ────────────────────────────────────────────────────────────────

function StepBadge({ step }: { step: number }) {
  return (
    <div style={{
      position:        'absolute',
      top:             -5,
      left:            -5,
      width:           16,
      height:          16,
      borderRadius:    '50%',
      background:      '#ffffff',
      border:          '1px solid #6366f1',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      fontSize:        8,
      fontFamily:      'IBM Plex Mono, monospace',
      color:           '#6366f1',
      fontWeight:      700,
      zIndex:          10,
      pointerEvents:   'none',
      lineHeight:      1,
    }}>
      {step}
    </div>
  )
}

// ── Main ElementNode ──────────────────────────────────────────────────────────

const SVG_SHAPES = new Set([
  'circle', 'diamond', 'parallelogram', 'hexagon', 'cylinder', 'document',
  'triangle', 'star', 'cross', 'arrow-right', 'cloud', 'tag',
])

function DebugBadge({ id, step }: { id: string; step?: number }) {
  const layerIdx = useFlowchartStore((s) => {
    const chartId = s.activeChartId
    if (!chartId) return '?'
    const nodes = s.charts[chartId]?.nodes ?? []
    let ei = 0
    for (const n of nodes) {
      if (n.type === 'element') {
        if (n.id === id) return ei
        ei++
      }
    }
    return '?'
  })
  return (
    <div style={{
      position: 'absolute', top: -18, left: 0, fontSize: 7,
      fontFamily: 'IBM Plex Mono, monospace', color: '#f97316',
      background: '#fff8', borderRadius: 2, padding: '0 3px',
      whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999,
    }}>
      {id.slice(-8)} z:{layerIdx} step:{step ?? '?'}
    </div>
  )
}

// ── Preview node/edge types (populated after ElementNode is defined) ─────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let previewNodeTypes: NodeTypes = { screen: ScreenNode as any } as NodeTypes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const previewEdgeTypes: EdgeTypes = { animatedEdge: AnimatedEdge as any } as EdgeTypes

// ── Expand icon with hover preview ───────────────────────────────────────────

const PREVIEW_BASE = 720

function ExpandPreview({ elementId, expandedScreenId, anchorRef, elementHovered, onPreviewHover }: {
  elementId: string
  expandedScreenId: string
  anchorRef: React.RefObject<HTMLDivElement | null>
  elementHovered: boolean
  onPreviewHover: (hovering: boolean) => void
}) {
  const [animIn, setAnimIn] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enterRafRef = useRef<number | null>(null)
  const allNodes = useFlowchartStore(selectNodes)
  const allEdges = useFlowchartStore(selectEdges)

  const screen = allNodes.find((n) => n.id === expandedScreenId)
  const screenData = screen?.data as ScreenData | undefined
  const screenLevel = screenData?.level ?? 2

  const screenRatio = screenData?.ratio ?? '16:9'
  const ratioSize = ASPECT_RATIO_SIZES[screenRatio as AspectRatio] ?? ASPECT_RATIO_SIZES['16:9']
  const previewW = PREVIEW_BASE
  const previewH = Math.round(PREVIEW_BASE * (ratioSize.h / ratioSize.w))

  // Get only elements spatially inside THIS specific expanded screen, not all screens at this level
  const screenElements = useMemo(() => {
    if (!screen) return []
    const sx = screen.position.x, sy = screen.position.y
    const sw = screen.width ?? 534, sh = screen.height ?? 300
    return allNodes.filter((n) => {
      if (n.type !== 'element') return false
      const cx = n.position.x + (n.width ?? 120) / 2
      const cy = n.position.y + (n.height ?? 50) / 2
      return cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh
    })
  }, [allNodes, screen])
  const screenElementIds = useMemo(() => new Set(screenElements.map((n) => n.id)), [screenElements])
  const levelEdges = useMemo(() => edgesForNodes(allEdges, screenElementIds), [allEdges, screenElementIds])

  const previewNodes = useMemo(() => screenElements
    .map((n) => ({
      ...n,
      selected: false,
      draggable: false,
      zIndex: Math.max(1, (n.zIndex as number | undefined) ?? 1),
    })), [screenElements])

  const fitViewOpts = useMemo(() => ({ padding: 0.15 }), [])

  // Show overlay when element or preview is hovered
  const shouldShow = elementHovered

  useEffect(() => {
    if (shouldShow) {
      // Mount and calculate position
      if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null }
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect()
        const x = Math.min(rect.right + 12, window.innerWidth - previewW - 16)
        const y = Math.max(8, Math.min(rect.top - 40, window.innerHeight - previewH - 50))
        setTooltipPos({ x, y })
      }
      setMounted(true)
      setAnimIn(false)
      // Trigger enter animation on next frames
      if (enterRafRef.current) cancelAnimationFrame(enterRafRef.current)
      enterRafRef.current = requestAnimationFrame(() => {
        enterRafRef.current = requestAnimationFrame(() => {
          setAnimIn(true)
        })
      })
    } else {
      // Start exit animation, then unmount
      setAnimIn(false)
      exitTimerRef.current = setTimeout(() => setMounted(false), 450)
    }
    return () => {
      if (enterRafRef.current) cancelAnimationFrame(enterRafRef.current)
    }
  }, [shouldShow]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute bridge from element to overlay
  const bridgeStyle = useMemo(() => {
    if (!tooltipPos || !anchorRef.current) return null
    const rect = anchorRef.current.getBoundingClientRect()
    const bridgeLeft = rect.right
    const bridgeWidth = tooltipPos.x - rect.right + 4
    if (bridgeWidth <= 0) return null
    const bridgeTop = Math.min(rect.top, Math.max(8, tooltipPos.y))
    const bridgeBottom = Math.max(rect.bottom, Math.max(8, tooltipPos.y) + previewH)
    return {
      position: 'fixed' as const,
      left: bridgeLeft,
      top: bridgeTop,
      width: bridgeWidth,
      height: bridgeBottom - bridgeTop,
      zIndex: 9998,
    }
  }, [tooltipPos, anchorRef, previewH])

  if (!mounted || !screen || !tooltipPos) return null

  return createPortal(
        <>
        {/* Invisible bridge between element and overlay */}
        {bridgeStyle && (
          <div
            style={bridgeStyle}
            onMouseEnter={() => onPreviewHover(true)}
            onMouseLeave={() => onPreviewHover(false)}
          />
        )}
        <div
          style={{
            position: 'fixed', left: tooltipPos.x, top: Math.max(8, tooltipPos.y),
            zIndex: 9999, cursor: 'pointer',
            opacity: animIn ? 1 : 0,
            transform: animIn ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(10px)',
            transition: 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transformOrigin: 'top left',
          }}
          onMouseEnter={() => onPreviewHover(true)}
          onMouseLeave={() => onPreviewHover(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onPreviewHover(false)
            setMounted(false)
            window.dispatchEvent(new CustomEvent('fc-drill-down', { detail: { elementId } }))
            useFlowchartStore.getState().drillDown(elementId)
          }}
        >
          <div style={{
            width: previewW, borderRadius: 10,
            border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            background: screenData?.backgroundColor ?? '#f8fafc',
          }}>
            {/* Header */}
            <div style={{
              padding: '8px 14px',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 700,
              color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em',
              background: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>Level {screenLevel}: {screenData?.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreviewHover(false)
                  setMounted(false)
                }}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: '#94a3b8', padding: '0 2px', fontSize: 14, lineHeight: 1,
                  borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#6366f1' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8' }}
                title="Close preview"
              >
                ✕
              </button>
            </div>

            {/* ReactFlow canvas — screen content edge-to-edge */}
            <div style={{ width: previewW, height: previewH, pointerEvents: 'none' }}>
              <ReactFlowProvider>
                <PresentationContext.Provider value={{ presentationMode: false, nodeStates: {}, showSteps: false, showDebug: false }}>
                  <ReactFlow
                    nodes={previewNodes}
                    edges={levelEdges}
                    nodeTypes={previewNodeTypes}
                    edgeTypes={previewEdgeTypes}
                    defaultEdgeOptions={{ type: 'animatedEdge' }}
                    connectionMode={ConnectionMode.Loose}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    nodesFocusable={false}
                    elementsSelectable={false}
                    panOnDrag={false}
                    zoomOnScroll={false}
                    zoomOnPinch={false}
                    zoomOnDoubleClick={false}
                    preventScrolling={false}
                    fitView
                    fitViewOptions={fitViewOpts}
                    style={{ background: screenData?.backgroundColor ?? '#f8fafc' }}
                    proOptions={{ hideAttribution: true }}
                  />
                </PresentationContext.Provider>
              </ReactFlowProvider>
            </div>
          </div>
        </div>
        </>,
        document.body,
      )
}

export const ElementNode = memo(({ id, data, selected, width: nodeW, height: nodeH }: NodeProps) => {
  const { selectNode, updateNodeSize, updateNode } = useFlowchartStore()
  const { presentationMode, nodeStates, showSteps, showDebug } = usePresentationContext()
  const ns = presentationMode ? (nodeStates[id] ?? null) : null
  const d = data as unknown as ElementData
  const s = d.style
  const hasSvgShape  = SVG_SHAPES.has(d.shape ?? '')
  const isRounded    = d.shape === 'rounded-rect'
  const nodeRef      = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Hover state for expand preview (element + preview overlay)
  const [elHovered, setElHovered] = useState(false)
  const [previewHovered, setPreviewHovered] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPreview = !!d.expandedScreenId && !presentationMode
  const isHovered = elHovered || previewHovered

  const onElementEnter = useCallback(() => {
    if (!hasPreview) return
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
    setElHovered(true)
  }, [hasPreview])

  const onElementLeave = useCallback(() => {
    if (!hasPreview) return
    hideTimerRef.current = setTimeout(() => setElHovered(false), 200)
  }, [hasPreview])

  const onPreviewHover = useCallback((hovering: boolean) => {
    if (hovering) {
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
    }
    setPreviewHovered(hovering)
    if (!hovering) {
      hideTimerRef.current = setTimeout(() => setElHovered(false), 200)
    }
  }, [])

  // Image overlay: element has an imageUrl but is not an image/gif elementType
  const isImageOverlay = !!(d.imageUrl && d.elementType !== 'image' && d.elementType !== 'gif' && d.elementType !== 'premade')
  const imageTextPos: TextPosition = isImageOverlay ? (d.textPosition ?? 'bottom') : 'none'

  // Exit edit mode when deselected
  useEffect(() => {
    if (!selected && isEditing) setIsEditing(false)
  }, [selected])

  function startEditing(e: React.MouseEvent) {
    e.stopPropagation()
    selectNode(id)
    setIsEditing(true)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.select()
      }
    }, 10)
  }

  function commitEdit(value: string) {
    updateNode(id, { text: value })
    setIsEditing(false)
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') { setIsEditing(false); e.preventDefault() }
    e.stopPropagation()
  }

  // Live animation preview via data attribute
  useEffect(() => {
    if (!nodeRef.current) return
    const el = nodeRef.current
    if (selected && d.animation.inType !== 'none') {
      el.setAttribute('data-preview-anim', d.animation.inType)
      el.classList.add('fc-anim-preview')
      const t = setTimeout(() => el.classList.remove('fc-anim-preview'), (d.animation.duration + 0.1) * 1000)
      return () => clearTimeout(t)
    } else {
      el.removeAttribute('data-preview-anim')
      el.classList.remove('fc-anim-preview')
    }
  }, [selected, d.animation.inType, d.animation.duration])

  // Hex color → rgba helper
  function hexToRgba(hex: string, alpha: number): string {
    if (hex.startsWith('rgba(') || hex.startsWith('rgb(')) return hex
    const h    = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  // Background color with separate opacity
  const bgColor = (() => {
    const bgOpacity = (s.backgroundOpacity ?? 100) / 100
    if (bgOpacity >= 1) return s.backgroundColor
    return hexToRgba(s.backgroundColor, bgOpacity)
  })()

  // Shadow — box for rect, drop-shadow filter for SVG shapes
  const shadowEnabled = s.shadowEnabled
  const shadowColorRgba = hexToRgba(s.shadowColor ?? '#000000', (s.shadowOpacity ?? 20) / 100)
  const shadowCss = shadowEnabled
    ? `${s.shadowX ?? 0}px ${s.shadowY ?? 2}px ${s.shadowBlur ?? 8}px ${shadowColorRgba}`
    : undefined

  const isTextOnly = d.elementType === 'text'

  const wrapperShadow = (hasSvgShape || isTextOnly) ? undefined : (
    selected
      ? '0 0 0 3px #6366f133'
      : (shadowEnabled ? shadowCss : '0 1px 3px #0000000f')
  )
  const svgFilter = hasSvgShape
    ? (shadowEnabled
        ? `drop-shadow(${shadowCss})`
        : undefined)
    : undefined

  const activeBorder = selected ? '#6366f1' : s.borderColor

  // For image + shape clip
  const imageWithShape = d.elementType === 'image' && d.imageUrl && d.shape && d.shape !== 'rectangle'

  return (
    <div
      ref={nodeRef}
      className="fc-element-node"
      onClick={() => selectNode(id)}
      onDoubleClick={startEditing}
      onMouseEnter={onElementEnter}
      onMouseLeave={onElementLeave}
      style={{
        width:        '100%',
        height:       '100%',
        position:     'relative',
        // In presentation mode all visual styling lives inside the animated wrapper,
        // so the outer div must be transparent/borderless to avoid a "ghost rectangle"
        // appearing before the element animates in.
        backgroundColor: presentationMode ? 'transparent' : ((hasSvgShape || isTextOnly) ? 'transparent' : bgColor),
        border:       presentationMode ? 'none' : ((hasSvgShape || isTextOnly) ? 'none' : `${s.borderWidth}px solid ${activeBorder}`),
        borderRadius: (presentationMode || hasSvgShape) ? 0 : (isRounded ? 12 : s.borderRadius),
        opacity:      s.opacity,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        overflow:     'visible',
        cursor:       'default',
        boxSizing:    'border-box',
        boxShadow:    presentationMode ? 'none' : wrapperShadow,
        transition:   presentationMode ? 'none' : 'box-shadow .12s, border-color .12s',
        outline:      (!presentationMode && selected) ? '3px solid #6366f1' : 'none',
        outlineOffset: (!presentationMode && selected) ? '2px' : '0',
      }}
    >
      {!presentationMode && (
        <NodeResizer
          isVisible={selected}
          minWidth={20}
          minHeight={16}
          keepAspectRatio={d.shape === 'circle'}
          lineStyle={{ borderColor: '#6366f1' }}
          handleStyle={{ backgroundColor: '#6366f1', width: 7, height: 7, borderRadius: 2 }}
          onResizeEnd={(_event, params) => {
            updateNodeSize(id, params.width, params.height)
          }}
        />
      )}

      {/* Step badge — visible in both modes (but hidden in presentation wrapper) */}
      {!presentationMode && showSteps && d.step !== undefined && <StepBadge step={d.step} />}

      {/* DEBUG: show id + layer z-index (array position among elements) */}
      {!presentationMode && showDebug && <DebugBadge id={id} step={d.step} />}

      {/* ── Presentation mode: all visual content in animated wrapper ── */}
      {/* The outer div is transparent, so ALL visual styling lives here.
          When opacity=0 the entire element (background, border, content) is invisible. */}
      {presentationMode && (
        <div
          key={ns?.animKey ?? id}
          style={{
            position: 'absolute', inset: 0,
            // Visual styling that was on outer div in normal mode
            backgroundColor: (hasSvgShape || isTextOnly) ? 'transparent' : bgColor,
            border:          (hasSvgShape || isTextOnly) ? 'none' : `${s.borderWidth}px solid ${s.borderColor}`,
            borderRadius:    isRounded ? 12 : s.borderRadius,
            boxShadow:       shadowEnabled ? shadowCss : undefined,
            overflow:        'visible',
            boxSizing:       'border-box',
            // Animation control — opacity 0 = fully invisible (including background + border)
            opacity: ns?.hidden ? 0 : 1,
            animation: (!ns?.hidden && ns?.animClass)
              ? `${ns.animClass} ${ns.animDuration ?? 0.4}s ease forwards`
              : undefined,
            animationDelay: ns?.animDelay ? `${ns.animDelay}s` : undefined,
          }}
        >
          {/* SVG shape background */}
          {hasSvgShape && d.shape && (
            <ShapeSVG
              shape={d.shape}
              color={s.backgroundColor}
              borderColor={activeBorder}
              borderWidth={s.borderWidth}
              style={svgFilter ? { filter: svgFilter } : undefined}
            />
          )}

          {/* Image: standalone or clipped to shape */}
          {(d.elementType === 'image' || d.elementType === 'gif') && d.imageUrl && !imageWithShape && (() => {
            const scale  = d.imageScale  ?? 100
            const radius = d.imageRadius ?? 0
            return (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: `${scale}%`, height: `${scale}%`, borderRadius: radius, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={d.imageUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: d.imageFit ?? 'cover', display: 'block' }} />
                </div>
              </div>
            )
          })()}
          {imageWithShape && d.imageUrl && (() => {
            const radius = d.imageRadius ?? 0
            const scale  = d.imageScale  ?? 100
            return (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                clipPath: d.shape === 'circle' ? 'ellipse(50% 50% at 50% 50%)'
                  : d.shape === 'diamond'   ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
                  : d.shape === 'triangle'  ? 'polygon(50% 0%, 100% 100%, 0% 100%)'
                  : undefined,
              }}>
                <div style={{ width: `${scale}%`, height: `${scale}%`, borderRadius: radius, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={d.imageUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: d.imageFit ?? 'cover', display: 'block' }} />
                </div>
              </div>
            )
          })()}

          {/* Premade SVG animation with configurable layout */}
          {d.elementType === 'premade' && d.premadeType && (() => {
            const layout: PremadeLayout = d.premadeLayout ?? 'top'
            const iconSize = d.premadeIconSize ?? Math.max(14, Math.min(Math.min(nodeW ?? 120, nodeH ?? 50) * 0.7, 96))
            const isHoriz  = layout === 'left' || layout === 'right'
            const showIcon = layout !== 'text-only'
            const showText = layout !== 'icon-only' && !!d.text
            return (
              <div style={{ display: 'flex', flexDirection: isHoriz ? (layout === 'left' ? 'row' : 'row-reverse') : (layout === 'bottom' ? 'column-reverse' : 'column'), alignItems: 'center', justifyContent: 'center', gap: 4, zIndex: 1, position: 'relative', width: '100%', height: '100%', padding: 4, boxSizing: 'border-box' }}>
                {showIcon && <PremadeSVG type={d.premadeType!} size={iconSize} color={s.borderColor} lottieUrl={d.lottieUrl} lottiePrimary={d.lottiePrimary} lottieSecondary={d.lottieSecondary} lottieDelay={d.lottieDelay} />}
                {showText && <div style={{ color: s.textColor, fontSize: s.fontSize, fontWeight: s.fontWeight, fontStyle: s.fontStyle ?? 'normal', fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif', textAlign: s.textAlign ?? 'center', lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%' }}>{renderMarkdown(d.text ?? '')}</div>}
              </div>
            )
          })()}

          {/* Text label (non-premade, non-image-overlay) */}
          {d.elementType !== 'premade' && !(d.imageUrl && d.elementType !== 'image' && d.elementType !== 'gif') && (d.text || isTextOnly) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: s.textAlign === 'left' ? 'flex-start' : s.textAlign === 'right' ? 'flex-end' : 'center', justifyContent: s.textVerticalAlign === 'top' ? 'flex-start' : s.textVerticalAlign === 'bottom' ? 'flex-end' : 'center', padding: '4px 6px', boxSizing: 'border-box', pointerEvents: 'none', zIndex: 2, overflow: 'hidden' }}>
              <div style={{ color: s.textColor, fontSize: s.fontSize, fontWeight: s.fontWeight, fontStyle: s.fontStyle ?? 'normal', fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif', textAlign: (s.textAlign ?? 'center') as React.CSSProperties['textAlign'], lineHeight: 1.3, wordBreak: 'break-word', maxWidth: '100%' }}>{renderMarkdown(d.text ?? '')}</div>
            </div>
          )}

          {/* Image overlay (non-image elementType with imageUrl) */}
          {isImageOverlay && (() => {
            const tp = imageTextPos
            const isHoriz = tp === 'left' || tp === 'right'
            const showCaption = tp !== 'none' && tp !== 'center' && !!d.text
            const showCenter  = tp === 'center' && !!d.text
            const vAlign = s.textVerticalAlign ?? 'middle'
            const captionJustify = vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center'
            const imgScale = d.imageScale ?? 100
            const imgRadius = d.imageRadius ?? 0
            const hAlign = s.textAlign ?? 'center'
            return (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: isHoriz ? (tp === 'left' ? 'row-reverse' : 'row') : (tp === 'top' ? 'column-reverse' : 'column'), alignItems: 'stretch', overflow: 'hidden', borderRadius: 'inherit' }}>
                <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: `${imgScale}%`, height: `${imgScale}%`, borderRadius: imgRadius, overflow: 'hidden', flexShrink: 0 }}>
                    <img src={d.imageUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: d.imageFit ?? 'cover', display: 'block' }} />
                  </div>
                </div>
                {showCaption && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: hAlign === 'left' ? 'flex-start' : hAlign === 'right' ? 'flex-end' : 'center', justifyContent: captionJustify, padding: '3px 6px', background: 'rgba(255,255,255,0.88)', flexShrink: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
                    <div style={{ wordBreak: 'break-word', maxWidth: '100%', textAlign: hAlign as React.CSSProperties['textAlign'], fontSize: s.fontSize, color: s.textColor, fontWeight: s.fontWeight, fontStyle: s.fontStyle ?? 'normal', fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif', lineHeight: 1.3 }}>{renderMarkdown(d.text ?? '')}</div>
                  </div>
                )}
                {showCenter && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: hAlign === 'left' ? 'flex-start' : hAlign === 'right' ? 'flex-end' : 'center', justifyContent: captionJustify, padding: '4px 6px', boxSizing: 'border-box', zIndex: 2 }}>
                    <div style={{ wordBreak: 'break-word', maxWidth: '100%', textAlign: hAlign as React.CSSProperties['textAlign'], textShadow: '0 1px 3px rgba(0,0,0,0.5)', fontSize: s.fontSize, color: s.textColor, fontWeight: s.fontWeight, fontStyle: s.fontStyle ?? 'normal', fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif', lineHeight: 1.3 }}>{renderMarkdown(d.text ?? '')}</div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Normal (non-presentation) mode: visual content rendered directly ── */}
      {!presentationMode && (
        <>

      {/* SVG shape background */}
      {hasSvgShape && d.shape && (
        <ShapeSVG
          shape={d.shape}
          color={s.backgroundColor}
          borderColor={activeBorder}
          borderWidth={s.borderWidth}
          style={svgFilter ? { filter: svgFilter } : undefined}
        />
      )}

      {/* Image: standalone or clipped to shape */}
      {(d.elementType === 'image' || d.elementType === 'gif') && d.imageUrl && !imageWithShape && (() => {
        const scale  = d.imageScale  ?? 100
        const radius = d.imageRadius ?? 0
        return (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* borderRadius on the wrapper with overflow:hidden works for all objectFit values including contain */}
            <div style={{ width: `${scale}%`, height: `${scale}%`, borderRadius: radius, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={d.imageUrl} alt=""
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: d.imageFit ?? 'cover', display: 'block' }}
              />
            </div>
          </div>
        )
      })()}
      {imageWithShape && d.imageUrl && (() => {
        const radius = d.imageRadius ?? 0
        const scale  = d.imageScale  ?? 100
        return (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            clipPath: d.shape === 'circle' ? 'ellipse(50% 50% at 50% 50%)'
              : d.shape === 'diamond'   ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
              : d.shape === 'triangle'  ? 'polygon(50% 0%, 100% 100%, 0% 100%)'
              : undefined,
          }}>
            <div style={{ width: `${scale}%`, height: `${scale}%`, borderRadius: radius, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={d.imageUrl} alt="" draggable={false}
                style={{ width: '100%', height: '100%', objectFit: d.imageFit ?? 'cover', display: 'block' }}
              />
            </div>
          </div>
        )
      })()}

      {/* Premade SVG animation with configurable layout */}
      {d.elementType === 'premade' && d.premadeType && !isEditing && (() => {
        const layout: PremadeLayout = d.premadeLayout ?? 'top'
        const iconSize = d.premadeIconSize ?? Math.max(14, Math.min(Math.min(nodeW ?? 120, nodeH ?? 50) * 0.7, 96))
        const isHoriz  = layout === 'left' || layout === 'right'
        const showIcon = layout !== 'text-only'
        const showText = layout !== 'icon-only' && !!d.text
        return (
          <div style={{
            display: 'flex',
            flexDirection: isHoriz ? (layout === 'left' ? 'row' : 'row-reverse') : (layout === 'bottom' ? 'column-reverse' : 'column'),
            alignItems: 'center', justifyContent: 'center',
            gap: 4, zIndex: 1, position: 'relative', width: '100%', height: '100%', padding: 4,
            boxSizing: 'border-box',
          }}>
            {showIcon && <PremadeSVG type={d.premadeType!} size={iconSize} color={s.borderColor} lottieUrl={d.lottieUrl} lottiePrimary={d.lottiePrimary} lottieSecondary={d.lottieSecondary} lottieDelay={d.lottieDelay} />}
            {showText && (
              <div style={{
                color: s.textColor, fontSize: s.fontSize, fontWeight: s.fontWeight,
                fontStyle: s.fontStyle ?? 'normal',
                fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif',
                textAlign: s.textAlign ?? 'center',
                lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%',
              }}>
                {renderMarkdown(d.text ?? '')}
              </div>
            )}
          </div>
        )
      })()}

      {/* Image inside shape — only when non-image elementType has an imageUrl */}
      {isImageOverlay && (() => {
        const tp = imageTextPos
        const isHoriz = tp === 'left' || tp === 'right'
        const showCaption = !isEditing && tp !== 'none' && tp !== 'center' && !!d.text
        const editCaption = isEditing  && tp !== 'none' && tp !== 'center'
        const showCenter  = !isEditing && tp === 'center' && !!d.text
        const vAlign = s.textVerticalAlign ?? 'middle'
        const captionJustify = vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center'
        const imgScale  = d.imageScale  ?? 100
        const imgRadius = d.imageRadius ?? 0
        const hAlign = s.textAlign ?? 'center'
        return (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: isHoriz ? (tp === 'left' ? 'row-reverse' : 'row') : (tp === 'top' ? 'column-reverse' : 'column'),
            alignItems: 'stretch', overflow: 'hidden', borderRadius: 'inherit',
          }}>
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: `${imgScale}%`, height: `${imgScale}%`, borderRadius: imgRadius, overflow: 'hidden', flexShrink: 0 }}>
                <img
                  src={d.imageUrl} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: d.imageFit ?? 'cover', display: 'block' }}
                />
              </div>
            </div>
            {/* Caption strip (top / bottom / left / right) — flex column for alignment */}
            {(showCaption || editCaption) && (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: hAlign === 'left' ? 'flex-start' : hAlign === 'right' ? 'flex-end' : 'center',
                justifyContent: captionJustify,
                padding: '3px 6px', background: 'rgba(255,255,255,0.88)',
                flexShrink: 0, boxSizing: 'border-box', overflow: 'hidden',
              }}>
                {showCaption && (
                  <div style={{
                    wordBreak: 'break-word', maxWidth: '100%',
                    textAlign: hAlign as React.CSSProperties['textAlign'],
                    fontSize: s.fontSize, color: s.textColor, fontWeight: s.fontWeight,
                    fontStyle: s.fontStyle ?? 'normal', fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif',
                    lineHeight: 1.3,
                  }}>{renderMarkdown(d.text ?? '')}</div>
                )}
                {editCaption && (
                  <textarea
                    ref={textareaRef}
                    className="nodrag nodrop"
                    defaultValue={d.text}
                    onBlur={(e) => commitEdit(e.target.value)}
                    onKeyDown={onTextareaKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    rows={Math.max(1, (d.text || '').split('\n').length)}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', resize: 'none',
                      padding: '0', color: s.textColor, fontSize: s.fontSize, fontWeight: s.fontWeight,
                      fontStyle: s.fontStyle ?? 'normal', fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif',
                      textAlign: hAlign as React.CSSProperties['textAlign'],
                      lineHeight: 1.3, outline: '2px solid #6366f1', outlineOffset: '2px',
                      boxSizing: 'border-box', overflow: 'auto',
                    }}
                  />
                )}
              </div>
            )}
            {/* Center overlay — same flex pattern as the non-image text label */}
            {(showCenter || (isEditing && tp === 'center')) && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: hAlign === 'left' ? 'flex-start' : hAlign === 'right' ? 'flex-end' : 'center',
                justifyContent: captionJustify,
                padding: '4px 6px', boxSizing: 'border-box', zIndex: isEditing ? 20 : 2,
              }}
                onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
                onClick={isEditing ? (e) => { e.stopPropagation(); textareaRef.current?.focus() } : undefined}
              >
                {showCenter && (
                  <div style={{
                    wordBreak: 'break-word', maxWidth: '100%',
                    textAlign: hAlign as React.CSSProperties['textAlign'],
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    fontSize: s.fontSize, color: s.textColor, fontWeight: s.fontWeight,
                    fontStyle: s.fontStyle ?? 'normal', fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif',
                    lineHeight: 1.3,
                  }}>{renderMarkdown(d.text ?? '')}</div>
                )}
                {isEditing && tp === 'center' && (
                  <textarea
                    ref={textareaRef}
                    className="nodrag nodrop"
                    defaultValue={d.text}
                    onBlur={(e) => commitEdit(e.target.value)}
                    onKeyDown={onTextareaKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    rows={Math.max(1, (d.text || '').split('\n').length)}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', resize: 'none',
                      padding: '0', color: s.textColor, fontSize: s.fontSize, fontWeight: s.fontWeight,
                      fontStyle: s.fontStyle ?? 'normal', fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif',
                      textAlign: hAlign as React.CSSProperties['textAlign'],
                      lineHeight: 1.3, outline: '2px solid #6366f1', outlineOffset: '2px',
                      boxSizing: 'border-box', overflow: 'auto',
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Text label (non-premade, non-image-overlay) */}
      {d.elementType !== 'premade' && !(d.imageUrl && d.elementType !== 'image' && d.elementType !== 'gif') && (d.text || isTextOnly) && !isEditing && (
        <div style={{
          position:      'absolute',
          inset:          0,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    s.textAlign === 'left' ? 'flex-start' : s.textAlign === 'right' ? 'flex-end' : 'center',
          justifyContent: s.textVerticalAlign === 'top' ? 'flex-start' : s.textVerticalAlign === 'bottom' ? 'flex-end' : 'center',
          padding:       '4px 6px',
          boxSizing:     'border-box',
          pointerEvents: 'none',
          zIndex:         2,
          overflow:      'hidden',
        }}>
          <div style={{
            color:      s.textColor,
            fontSize:   s.fontSize,
            fontWeight: s.fontWeight,
            fontStyle:  s.fontStyle ?? 'normal',
            fontFamily: s.fontFamily || 'IBM Plex Sans, sans-serif',
            textAlign:  s.textAlign ?? 'center',
            lineHeight: 1.3,
            wordBreak:  'break-word',
            maxWidth:   '100%',
          }}>
            {renderMarkdown(d.text ?? '')}
          </div>
        </div>
      )}

      {/* Inline text editor — only for non-image-overlay elements (image overlay handles its own editing) */}
      {isEditing && !isImageOverlay && (
        <div
          style={{
            position:      'absolute',
            inset:          0,
            display:       'flex',
            flexDirection: 'column',
            alignItems:    s.textAlign === 'left' ? 'flex-start' : s.textAlign === 'right' ? 'flex-end' : 'center',
            justifyContent: (s.textVerticalAlign ?? 'middle') === 'top' ? 'flex-start' : (s.textVerticalAlign ?? 'middle') === 'bottom' ? 'flex-end' : 'center',
            padding:       '4px 6px',
            boxSizing:     'border-box',
            zIndex:         20,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); textareaRef.current?.focus() }}
        >
          <textarea
            ref={textareaRef}
            className="nodrag nodrop"
            defaultValue={d.text}
            onBlur={(e) => commitEdit(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            rows={Math.max(1, (d.text || '').split('\n').length)}
            style={{
              width:       '100%',
              background:  'transparent',
              border:      'none',
              borderRadius: isRounded ? 12 : s.borderRadius,
              resize:      'none',
              padding:     '0',
              color:        s.textColor,
              fontSize:     s.fontSize,
              fontWeight:   s.fontWeight,
              fontStyle:    s.fontStyle ?? 'normal',
              fontFamily:   s.fontFamily || 'IBM Plex Sans, sans-serif',
              textAlign:    s.textAlign ?? 'center',
              lineHeight:   1.3,
              outline:      isTextOnly ? 'none' : '2px solid #6366f1',
              outlineOffset: '2px',
              boxSizing:   'border-box',
              overflow:    'auto',
            }}
          />
        </div>
      )}

        </>
      )}

      {/* Handles — always rendered so React Flow can route edges correctly.
          In presentation mode they are invisible and non-interactive. */}
      {/* Hover preview — shown when element has a deeper-level screen */}
      {hasPreview && (
        <ExpandPreview
          elementId={id}
          expandedScreenId={d.expandedScreenId!}
          anchorRef={nodeRef}
          elementHovered={isHovered}
          onPreviewHover={onPreviewHover}
        />
      )}

      {(['Top', 'Bottom', 'Left', 'Right'] as const).map((pos) => (
        <Handle
          key={pos}
          type="source"
          position={Position[pos]}
          id={pos.toLowerCase()}
          className={presentationMode ? '' : 'fc-handle'}
          style={presentationMode ? {
            background: 'transparent', border: 'none',
            width: 1, height: 1, opacity: 0, pointerEvents: 'none',
          } : {
            background:  '#6366f1',
            border:      '2px solid #fff',
            width:        12,
            height:       12,
            transition:  'opacity .12s',
          }}
        />
      ))}
    </div>
  )
})

ElementNode.displayName = 'ElementNode'

// Register ElementNode into preview types now that it's defined
// eslint-disable-next-line @typescript-eslint/no-explicit-any
previewNodeTypes = { screen: ScreenNode as any, element: ElementNode as any } as NodeTypes
