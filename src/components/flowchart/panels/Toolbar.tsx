import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useFlowchartStore } from '../../../store/useFlowchartStore'
import { lordinconApi } from '../../../api/client'
import type { ElementData, PremadeType, ShapeType } from '../../../types/flowchart'

// ── Minimal SVG icons ─────────────────────────────────────────────────────────

function IconFrame() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x={2} y={3} width={16} height={11} rx={1.5} />
      <line x1={8} y1={14} x2={12} y2={14} />
      <line x1={10} y1={14} x2={10} y2={17} />
    </svg>
  )
}
function IconShapes() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={2} width={7} height={7} rx={1} />
      <circle cx={14} cy={6} r={3.5} />
      <polygon points="5,12 8,18 2,18" />
      <polygon points="12,12 18,12 18,18 12,18" />
    </svg>
  )
}
function IconText() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4,4 L16,4 M10,4 L10,16 M7,16 L13,16" />
    </svg>
  )
}
function IconImage() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={4} width={16} height={12} rx={1.5} />
      <path d="M2,13 L7,9 L11,12 L14,9 L18,13" />
      <circle cx={6} cy={8} r={1.5} />
    </svg>
  )
}
function IconProcess() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M10,3 A7,7 0 1,1 3,10" />
      <path d="M10,3 L12,1 M10,3 L8,1" />
    </svg>
  )
}
function IconActions() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10,16 L10,4 M5,9 L10,4 L15,9" />
    </svg>
  )
}
function IconStatus() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx={10} cy={10} r={7} />
      <path d="M7,10 L9,12 L13,8" />
    </svg>
  )
}
function IconComms() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3,5 Q3,3 5,3 L15,3 Q17,3 17,5 L17,12 Q17,14 15,14 L11,14 L8,17 L8,14 L5,14 Q3,14 3,12 Z" />
    </svg>
  )
}
function IconSystem() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={6} width={16} height={8} rx={1} />
      <path d="M6,6 L6,4 M10,6 L10,4 M14,6 L14,4" />
      <circle cx={6} cy={10} r={1} fill="currentColor" />
      <circle cx={10} cy={10} r={1} fill="currentColor" />
      <circle cx={14} cy={10} r={1} fill="currentColor" />
    </svg>
  )
}
function IconIcons() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10,3 L11.5,7.5 L16,7.5 L12.5,10.5 L14,15 L10,12 L6,15 L7.5,10.5 L4,7.5 L8.5,7.5 Z" />
    </svg>
  )
}
function IconLordicon() {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx={10} cy={10} r={7} />
      <path d="M7,8 Q8.5,6 10,8 Q11.5,10 13,8" />
      <path d="M7,12 Q8.5,10 10,12 Q11.5,14 13,12" />
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────

const SHAPE_ITEMS: { shape: ShapeType; label: string; symbol: string }[] = [
  { shape: 'rectangle',     label: 'Rectangle',    symbol: '▬' },
  { shape: 'rounded-rect',  label: 'Rounded',      symbol: '▭' },
  { shape: 'circle',        label: 'Circle',       symbol: '●' },
  { shape: 'diamond',       label: 'Diamond',      symbol: '◆' },
  { shape: 'parallelogram', label: 'Parallelogram', symbol: '▱' },
  { shape: 'cylinder',      label: 'Cylinder',     symbol: '⌗' },
  { shape: 'hexagon',       label: 'Hexagon',      symbol: '⬡' },
  { shape: 'document',      label: 'Document',     symbol: '▤' },
  { shape: 'triangle',      label: 'Triangle',     symbol: '▲' },
  { shape: 'star',          label: 'Star',         symbol: '★' },
  { shape: 'cross',         label: 'Cross',        symbol: '✚' },
  { shape: 'arrow-right',   label: 'Arrow',        symbol: '➤' },
  { shape: 'cloud',         label: 'Cloud',        symbol: '☁' },
  { shape: 'tag',           label: 'Tag',          symbol: '⬖' },
]


interface PremadeGroup {
  id: string; label: string; icon: React.ReactNode
  items: { type: PremadeType; label: string; symbol: string }[]
}

const PREMADE_GROUPS: PremadeGroup[] = [
  {
    id: 'processing', label: 'Processing', icon: <IconProcess />,
    items: [
      { type: 'processing',  label: 'Dots',        symbol: '◉' },
      { type: 'building',    label: 'Building',    symbol: '▦' },
      { type: 'loading',     label: 'Loading',     symbol: '▬' },
      { type: 'waiting',     label: 'Waiting',     symbol: '○' },
      { type: 'syncing',     label: 'Syncing',     symbol: '↻' },
      { type: 'scanning',    label: 'Scanning',    symbol: '≡' },
      { type: 'refresh',     label: 'Refresh',     symbol: '⟳' },
    ],
  },
  {
    id: 'actions', label: 'Actions', icon: <IconActions />,
    items: [
      { type: 'writing',     label: 'Writing',     symbol: '▌' },
      { type: 'uploading',   label: 'Uploading',   symbol: '↑' },
      { type: 'downloading', label: 'Downloading', symbol: '↓' },
      { type: 'sending',     label: 'Sending',     symbol: '→' },
      { type: 'connecting',  label: 'Connecting',  symbol: '⊶' },
      { type: 'api',         label: 'API Call',    symbol: '⇄' },
    ],
  },
  {
    id: 'status', label: 'Status', icon: <IconStatus />,
    items: [
      { type: 'checking',    label: 'Checking',    symbol: '✓' },
      { type: 'success',     label: 'Success',     symbol: '✔' },
      { type: 'error',       label: 'Error',       symbol: '✗' },
      { type: 'warning',     label: 'Warning',     symbol: '⚠' },
      { type: 'recording',   label: 'Recording',   symbol: '●' },
      { type: 'shield',      label: 'Shield',      symbol: '⛊' },
      { type: 'lock',        label: 'Lock',        symbol: '🔒' },
    ],
  },
  {
    id: 'comms', label: 'Comms', icon: <IconComms />,
    items: [
      { type: 'thinking',    label: 'Thinking',    symbol: '···' },
      { type: 'typing',      label: 'Typing',      symbol: '💬' },
      { type: 'broadcasting',label: 'Broadcasting',symbol: '◎' },
      { type: 'streaming',   label: 'Streaming',   symbol: '≈' },
      { type: 'user',        label: 'User',        symbol: '◎' },
    ],
  },
  {
    id: 'system', label: 'System', icon: <IconSystem />,
    items: [
      { type: 'database',    label: 'Database',    symbol: '⌗' },
      { type: 'server',      label: 'Server',      symbol: '▤' },
      { type: 'clock',       label: 'Clock',       symbol: '○' },
      { type: 'fire',        label: 'Fire',        symbol: '🔥' },
      { type: 'sparkle',     label: 'Sparkle',     symbol: '✦' },
    ],
  },
  {
    id: 'icons', label: 'Icons', icon: <IconIcons />,
    items: [
      // Communications
      { type: 'lucide-bell',            label: 'Bell',           symbol: '🔔' },
      { type: 'lucide-bell-ring',        label: 'Bell Ring',      symbol: '🔔' },
      { type: 'lucide-mail',             label: 'Mail',           symbol: '✉' },
      { type: 'lucide-mail-open',        label: 'Mail Open',      symbol: '📬' },
      { type: 'lucide-phone',            label: 'Phone',          symbol: '☎' },
      { type: 'lucide-phone-call',       label: 'Phone Call',     symbol: '📞' },
      { type: 'lucide-message-circle',   label: 'Message',        symbol: '💬' },
      { type: 'lucide-message-square',   label: 'Message Sq',     symbol: '🗨' },
      { type: 'lucide-send',             label: 'Send',           symbol: '➤' },
      { type: 'lucide-mic',              label: 'Mic',            symbol: '🎤' },
      { type: 'lucide-video',            label: 'Video',          symbol: '📷' },
      { type: 'lucide-headphones',       label: 'Headphones',     symbol: '🎧' },
      // Status & Alerts
      { type: 'lucide-check-circle',     label: 'Check',          symbol: '✓' },
      { type: 'lucide-x-circle',         label: 'Error',          symbol: '✗' },
      { type: 'lucide-alert-circle',     label: 'Alert',          symbol: '⚠' },
      { type: 'lucide-alert-triangle',   label: 'Warning',        symbol: '△' },
      { type: 'lucide-info',             label: 'Info',           symbol: 'ℹ' },
      { type: 'lucide-zap',              label: 'Zap',            symbol: '⚡' },
      { type: 'lucide-shield',           label: 'Shield',         symbol: '⛊' },
      { type: 'lucide-lock',             label: 'Lock',           symbol: '🔒' },
      { type: 'lucide-eye',              label: 'Eye',            symbol: '👁' },
      // Data & Tech
      { type: 'lucide-database',         label: 'Database',       symbol: '⌗' },
      { type: 'lucide-server',           label: 'Server',         symbol: '▤' },
      { type: 'lucide-cpu',              label: 'CPU',            symbol: '⊡' },
      { type: 'lucide-hard-drive',       label: 'Hard Drive',     symbol: '💾' },
      { type: 'lucide-wifi',             label: 'Wifi',           symbol: '⌾' },
      { type: 'lucide-bluetooth',        label: 'Bluetooth',      symbol: '⊹' },
      { type: 'lucide-cloud',            label: 'Cloud',          symbol: '☁' },
      { type: 'lucide-globe',            label: 'Globe',          symbol: '🌐' },
      { type: 'lucide-terminal',         label: 'Terminal',       symbol: '>_' },
      { type: 'lucide-code',             label: 'Code',           symbol: '</>' },
      { type: 'lucide-layers',           label: 'Layers',         symbol: '⊟' },
      { type: 'lucide-git-branch',       label: 'Git Branch',     symbol: '⎇' },
      // Media & Files
      { type: 'lucide-play',             label: 'Play',           symbol: '▶' },
      { type: 'lucide-pause',            label: 'Pause',          symbol: '⏸' },
      { type: 'lucide-music',            label: 'Music',          symbol: '♪' },
      { type: 'lucide-image',            label: 'Image',          symbol: '🖼' },
      { type: 'lucide-camera',           label: 'Camera',         symbol: '📷' },
      { type: 'lucide-film',             label: 'Film',           symbol: '🎬' },
      { type: 'lucide-download',         label: 'Download',       symbol: '↓' },
      { type: 'lucide-upload',           label: 'Upload',         symbol: '↑' },
      // People
      { type: 'lucide-user',             label: 'User',           symbol: '👤' },
      { type: 'lucide-users',            label: 'Users',          symbol: '👥' },
      { type: 'lucide-user-plus',        label: 'Add User',       symbol: '👤+' },
      { type: 'lucide-user-check',       label: 'User OK',        symbol: '👤✓' },
      // Objects & Misc
      { type: 'lucide-heart',            label: 'Heart',          symbol: '♥' },
      { type: 'lucide-star',             label: 'Star',           symbol: '★' },
      { type: 'lucide-bookmark',         label: 'Bookmark',       symbol: '🔖' },
      { type: 'lucide-flag',             label: 'Flag',           symbol: '⚑' },
      { type: 'lucide-tag',              label: 'Tag',            symbol: '🏷' },
      { type: 'lucide-gift',             label: 'Gift',           symbol: '🎁' },
      { type: 'lucide-package',          label: 'Package',        symbol: '📦' },
      { type: 'lucide-activity',         label: 'Activity',       symbol: '◎' },
      // Time & Navigation
      { type: 'lucide-clock',            label: 'Clock',          symbol: '🕐' },
      { type: 'lucide-calendar',         label: 'Calendar',       symbol: '📅' },
      { type: 'lucide-timer',            label: 'Timer',          symbol: '⏱' },
      { type: 'lucide-alarm-clock',      label: 'Alarm',          symbol: '⏰' },
      { type: 'lucide-map-pin',          label: 'Map Pin',        symbol: '📍' },
      { type: 'lucide-navigation',       label: 'Navigation',     symbol: '◎' },
      { type: 'lucide-compass',          label: 'Compass',        symbol: '⊕' },
      // Actions
      { type: 'lucide-settings',         label: 'Settings',       symbol: '⚙' },
      { type: 'lucide-refresh-cw',       label: 'Refresh',        symbol: '↻' },
      { type: 'lucide-search',           label: 'Search',         symbol: '⌕' },
      { type: 'lucide-filter',           label: 'Filter',         symbol: '⊟' },
      { type: 'lucide-edit',             label: 'Edit',           symbol: '✎' },
      { type: 'lucide-trash-2',          label: 'Delete',         symbol: '🗑' },
      { type: 'lucide-copy',             label: 'Copy',           symbol: '⧉' },
      { type: 'lucide-share',            label: 'Share',          symbol: '↗' },
    ],
  },
]

// ── Lordicon dynamic picker ────────────────────────────────────────────────────

interface LICategory { id: number; title: string; count: number; promoted: boolean }
interface LIIcon     { id: number; index: number; name: string; title: string }

export function LordinconPickerFlyout({
  onClose, anchorTop,
  onSelect, centered,
}: {
  onClose: () => void
  anchorTop: number
  onSelect: (iconUrl: string, name: string, title: string) => void
  centered?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [categories, setCategories]     = useState<LICategory[]>([])
  const [activeCat, setActiveCat]       = useState<LICategory | null>(null)
  const [icons, setIcons]               = useState<LIIcon[]>([])
  const [query, setQuery]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [embedLoading, setEmbedLoading] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const loadIcons = useCallback((categoryId: number) => {
    setLoading(true)
    setIcons([])
    lordinconApi.icons(categoryId)
      .then((res) => setIcons(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    lordinconApi.sidebar().then((res) => {
      const cats = res.data.categories ?? []
      setCategories(cats)
      const first = cats.find((c) => c.promoted) ?? cats[0]
      if (first) { setActiveCat(first); loadIcons(first.id) }
    }).catch(() => {})
  }, [loadIcons])

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) {
      if (activeCat) loadIcons(activeCat.id)
      return
    }
    setLoading(true)
    setIcons([])
    lordinconApi.search(q.trim())
      .then((res) => setIcons(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeCat, loadIcons])

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 400)
  }

  function handleCatClick(cat: LICategory) {
    setActiveCat(cat)
    setQuery('')
    loadIcons(cat.id)
  }

  async function handleIconClick(icon: LIIcon) {
    setEmbedLoading(icon.id)
    try {
      const res = await lordinconApi.embed(`${icon.index}-${icon.name}`)
      onSelect(res.data.icon, icon.name, icon.title)
      onClose()
    } catch {
      // ignore
    } finally {
      setEmbedLoading(null)
    }
  }

  // Clamp so panel never goes off-screen (panel height ≈ 420)
  const maxH = window.innerHeight - 80
  const topPos = Math.min(Math.max(8, anchorTop - 16), window.innerHeight - Math.min(420, maxH) - 8)
  const panelH = Math.min(420, maxH)
  const bodyH  = panelH - 68 // subtract header height

  return (
    <div
      ref={ref}
      style={{
        position:      'fixed',
        ...(centered
          ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
          : { left: 62, top: topPos }),
        zIndex:         1000,
        background:    '#ffffff',
        border:        '1px solid #e2e8f0',
        borderRadius:   10,
        boxShadow:     '0 8px 32px #0000001a, 0 2px 8px #00000010',
        width:          340,
        height:         panelH,
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
      }}
    >
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '10px 12px 8px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Lordicon — Animated Icons
        </div>
        <input
          autoFocus
          placeholder="Search icons…"
          value={query}
          onChange={handleQueryChange}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '5px 8px',
            border: '1px solid #e2e8f0', borderRadius: 5,
            fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
            outline: 'none', background: '#f8fafc',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#6366f1' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = '#e2e8f0' }}
        />
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, height: bodyH, overflow: 'hidden' }}>

        {/* Category sidebar — hidden while searching */}
        {!query.trim() && (
          <div style={{
            width: 106, flexShrink: 0,
            borderRight: '1px solid #f1f5f9',
            overflowY: 'auto', padding: '4px 0',
          }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCatClick(cat)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '5px 8px',
                  background: activeCat?.id === cat.id ? '#6366f10f' : 'transparent',
                  border: 'none',
                  borderLeft: activeCat?.id === cat.id ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: 10, fontFamily: 'IBM Plex Mono, monospace',
                  color: activeCat?.id === cat.id ? '#6366f1' : '#64748b',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  lineHeight: 1.6,
                }}
              >
                {cat.title}
                <span style={{ marginLeft: 4, fontSize: 8, color: '#94a3b8' }}>{cat.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Icon grid */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: 6 }}>
          {loading ? (
            <div style={{ textAlign: 'center', paddingTop: 32, fontSize: 11, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>
              Loading…
            </div>
          ) : icons.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 32, fontSize: 11, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>
              No results
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, width: '100%', minWidth: 0 }}>
              {icons.map((icon) => {
                const svgUrl = `https://media.lordicon.com/icons/wired/outline/${icon.index}-${icon.name}.svg`
                const busy   = embedLoading === icon.id
                return (
                  <button
                    key={icon.id}
                    title={icon.title}
                    onClick={() => handleIconClick(icon)}
                    disabled={busy}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 4, padding: '8px 4px 6px',
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                      borderRadius: 7, cursor: busy ? 'wait' : 'pointer',
                      opacity: busy ? 0.5 : 1,
                      transition: 'all .1s',
                      minWidth: 0, overflow: 'hidden', boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      const b = e.currentTarget as HTMLButtonElement
                      b.style.background  = '#eef2ff'
                      b.style.borderColor = '#6366f1'
                    }}
                    onMouseLeave={(e) => {
                      const b = e.currentTarget as HTMLButtonElement
                      b.style.background  = '#f8fafc'
                      b.style.borderColor = '#e2e8f0'
                    }}
                  >
                    <img
                      src={svgUrl}
                      alt={icon.title}
                      width={28}
                      height={28}
                      style={{ objectFit: 'contain', pointerEvents: 'none' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                    <span style={{
                      fontSize: 7, fontFamily: 'IBM Plex Mono, monospace', color: '#64748b',
                      lineHeight: 1.2, textAlign: 'center', width: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {icon.title}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Flyout panel ──────────────────────────────────────────────────────────────

interface FlyoutItem { label: string; symbol: string; onClick: () => void }

function Flyout({
  title, items, onClose, anchorTop,
}: {
  title: string; items: FlyoutItem[]; onClose: () => void; anchorTop: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = q.trim()
    ? items.filter((it) => it.label.toLowerCase().includes(q.toLowerCase()))
    : items

  const topPos = Math.min(Math.max(8, anchorTop - 16), window.innerHeight - 320)

  return (
    <div
      ref={ref}
      style={{
        position:     'fixed',
        left:          62,
        top:           topPos,
        zIndex:        1000,
        background:    '#ffffff',
        border:        '1px solid #e2e8f0',
        borderRadius:  10,
        boxShadow:     '0 8px 32px #0000001a, 0 2px 8px #00000010',
        padding:       12,
        width:         220,
      }}
    >
      <div style={{
        fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
      }}>
        {title}
      </div>

      {/* Search */}
      <input
        autoFocus
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '5px 8px', marginBottom: 8,
          border: '1px solid #e2e8f0', borderRadius: 5,
          fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
          outline: 'none', background: '#f8fafc',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#6366f1' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
      />

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '16px 0', fontSize: 11, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>
            No results
          </div>
        ) : filtered.map((item) => (
          <button
            key={item.label}
            title={item.label}
            onClick={() => { item.onClick(); onClose() }}
            style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              gap:            3,
              padding:       '8px 4px',
              background:    '#f8fafc',
              border:        '1px solid #e2e8f0',
              borderRadius:   6,
              cursor:        'pointer',
              transition:    'all .1s',
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background  = '#6366f10f'
              b.style.borderColor = '#6366f1'
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background  = '#f8fafc'
              b.style.borderColor = '#e2e8f0'
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{item.symbol}</span>
            <span style={{
              fontSize: 7, fontFamily: 'IBM Plex Mono, monospace', color: '#64748b',
              lineHeight: 1.2, textAlign: 'center', width: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Category button ───────────────────────────────────────────────────────────

function CatBtn({
  icon, label, active, onClick, btnRef,
}: {
  icon: React.ReactNode; label: string; active: boolean
  onClick: () => void; btnRef?: (el: HTMLButtonElement | null) => void
}) {
  return (
    <button
      ref={btnRef}
      title={label}
      onClick={onClick}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:            2,
        padding:       '6px 0',
        width:         '100%',
        background:    active ? '#6366f10f' : 'transparent',
        border:        `1px solid ${active ? '#6366f140' : 'transparent'}`,
        borderRadius:   6,
        color:         active ? '#6366f1' : '#64748b',
        cursor:        'pointer',
        transition:    'all .12s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          const b = e.currentTarget as HTMLButtonElement
          b.style.background = '#f1f5f9'
          b.style.color      = '#6366f1'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          const b = e.currentTarget as HTMLButtonElement
          b.style.background = 'transparent'
          b.style.color      = '#64748b'
        }
      }}
    >
      {icon}
      <span style={{ fontSize: 6, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.02em', lineHeight: 1 }}>
        {label.slice(0, 5)}
      </span>
    </button>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#e2e8f0', width: '80%', margin: '2px auto' }} />
}

// ── Main toolbar ──────────────────────────────────────────────────────────────

export const Toolbar = memo(() => {
  const { addScreen, addElement, currentLevel } = useFlowchartStore()
  const rf = useReactFlow()
  const [flyout, setFlyout] = useState<{ id: string; top: number } | null>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  function addEl(opts: Partial<ElementData>) {
    // Place element at center of the visible React Flow canvas
    const pane = document.querySelector('.react-flow__pane') as HTMLElement | null
    let pos: { x: number; y: number } | undefined
    if (pane) {
      const rect = pane.getBoundingClientRect()
      pos = rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }
    addElement(opts, pos)
  }

  function toggleFlyout(id: string) {
    if (flyout?.id === id) { setFlyout(null); return }
    const btn = btnRefs.current[id]
    const top = btn ? btn.getBoundingClientRect().top : 100
    setFlyout({ id, top })
  }

  const shapeItems: FlyoutItem[] = SHAPE_ITEMS.map(({ shape, label, symbol }) => ({
    label, symbol,
    onClick: () => addEl({ elementType: 'shape', shape, text: label }),
  }))


  return (
    <>
      <div style={{
        position:      'absolute',
        top:           '50%',
        left:           8,
        transform:     'translateY(-50%)',
        zIndex:         20,
        background:    '#ffffff',
        border:        '1px solid #e2e8f0',
        borderRadius:   10,
        padding:       '6px 4px',
        display:       'flex',
        flexDirection: 'column',
        gap:            2,
        boxShadow:     '0 4px 20px #0000000f, 0 1px 4px #00000008',
        width:          48,
        alignItems:    'center',
      }}>
        {/* Add Frame */}
        <button
          title={currentLevel > 1 ? 'Screens can only be added at Level 1' : 'Add Screen'}
          onClick={() => {
            if (currentLevel > 1) return
            const newId = addScreen()
            if (newId) {
              setTimeout(() => {
                rf.fitView({ nodes: [{ id: newId }], duration: 450, padding: 0.3 })
              }, 30)
            }
          }}
          style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:            2,
            padding:       '7px 0',
            width:         '100%',
            background:    'transparent',
            border:        '1px solid transparent',
            borderRadius:   6,
            color:         currentLevel > 1 ? '#cbd5e1' : '#6366f1',
            cursor:        currentLevel > 1 ? 'not-allowed' : 'pointer',
            opacity:       currentLevel > 1 ? 0.5 : 1,
          }}
          onMouseEnter={(e) => { if (currentLevel <= 1) (e.currentTarget as HTMLButtonElement).style.background = '#6366f10f' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <IconFrame />
          <span style={{ fontSize: 6, fontFamily: 'IBM Plex Mono, monospace', color: currentLevel > 1 ? '#cbd5e1' : '#6366f1', lineHeight: 1 }}>Screen</span>
        </button>

        <Divider />

        {/* Shapes */}
        <CatBtn icon={<IconShapes />} label="Shapes" active={flyout?.id === 'shapes'}
          onClick={() => toggleFlyout('shapes')}
          btnRef={(el) => { btnRefs.current['shapes'] = el }} />

        {/* Text — direct action, no flyout */}
        <CatBtn icon={<IconText />} label="Text" active={false}
          onClick={() => { addEl({ elementType: 'text', shape: undefined, text: 'Text', imageUrl: undefined }); setFlyout(null) }}
          btnRef={(el) => { btnRefs.current['text'] = el }} />

        {/* Image — direct action, no flyout */}
        <CatBtn icon={<IconImage />} label="Image" active={false}
          onClick={() => { addEl({ elementType: 'image', shape: 'rectangle', text: '', imageUrl: '' }); setFlyout(null) }}
          btnRef={(el) => { btnRefs.current['image'] = el }} />

        <Divider />

        {/* Premade groups */}
        {PREMADE_GROUPS.map((group) => (
          <CatBtn
            key={group.id}
            icon={group.icon}
            label={group.label}
            active={flyout?.id === group.id}
            onClick={() => toggleFlyout(group.id)}
            btnRef={(el) => { btnRefs.current[group.id] = el }}
          />
        ))}

        {/* Lordicon — dynamic picker */}
        <CatBtn
          icon={<IconLordicon />}
          label="Lrdicn"
          active={flyout?.id === 'lordicon'}
          onClick={() => toggleFlyout('lordicon')}
          btnRef={(el) => { btnRefs.current['lordicon'] = el }}
        />
      </div>

      {/* Flyout panels */}
      {flyout?.id === 'shapes' && (
        <Flyout title="Shapes" items={shapeItems} onClose={() => setFlyout(null)} anchorTop={flyout.top} />
      )}
      {PREMADE_GROUPS.map((group) =>
        flyout?.id === group.id ? (
          <Flyout
            key={group.id}
            title={group.label}
            items={group.items.map(({ type, label, symbol }) => ({
              label, symbol,
              onClick: () => addEl({ elementType: 'premade', premadeType: type, text: label }),
            }))}
            onClose={() => setFlyout(null)}
            anchorTop={flyout.top}
          />
        ) : null
      )}
      {flyout?.id === 'lordicon' && (
        <LordinconPickerFlyout
          anchorTop={flyout.top}
          onClose={() => setFlyout(null)}
          onSelect={(iconUrl, name, title) => {
            addEl({
              elementType: 'premade',
              premadeType: `lottie-${name}` as PremadeType,
              lottieUrl: iconUrl,
              lottiePrimary: '#000000',
              lottieSecondary: '#6366f1',
              lottieDelay: 500,
              text: title,
            })
          }}
        />
      )}
    </>
  )
})

Toolbar.displayName = 'Toolbar'
