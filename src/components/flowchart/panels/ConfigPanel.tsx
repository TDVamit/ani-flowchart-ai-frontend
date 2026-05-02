import { memo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFlowchartStore, selectNodes, selectEdges } from '../../../store/useFlowchartStore'
import { flowchartAssetsApi } from '../../../api/client'
import { LordinconPickerFlyout } from './Toolbar'
import type {
  ScreenData, ElementData, EdgeData,
  AspectRatio, InAnimationType, EdgeAnimationType, EdgeInType, EdgeLineType, EdgeArrowType, EdgePathType,
  PremadeLayout, TextPosition,
} from '../../../types/flowchart'
import { ASPECT_RATIO_SIZES } from '../../../types/flowchart'
import { useReactFlow } from '@xyflow/react'

// ── Field primitives ──────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  background:   '#f8fafc',
  border:       '1px solid #e2e8f0',
  borderRadius: 4,
  color:        '#1e293b',
  padding:      '4px 7px',
  fontSize:     11,
  fontFamily:   'IBM Plex Mono, monospace',
  width:        '100%',
  boxSizing:    'border-box',
  outline:      'none',
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input style={inp} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

function NumberInput({ value, onChange, min, max, step, allowEmpty, fallback }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
  allowEmpty?: boolean; fallback?: number
}) {
  const [local, setLocal]   = useState(String(value))
  const [focused, setFocused] = useState(false)

  // Sync when the external value changes and we're not editing
  useEffect(() => { if (!focused) setLocal(String(value)) }, [value, focused])

  if (!allowEmpty) {
    return (
      <input type="number" style={inp} value={value} min={min} max={max} step={step ?? 1}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    )
  }

  const isEmpty = local.trim() === '' || local.trim() === '-'
  return (
    <input
      type="number"
      style={{ ...inp, borderColor: isEmpty ? '#ef4444' : undefined, color: isEmpty ? '#ef4444' : undefined, outline: isEmpty ? 'none' : undefined }}
      value={local}
      min={min} max={max} step={step ?? 1}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        const parsed = parseFloat(local)
        if (!isFinite(parsed)) {
          const def = fallback ?? min ?? 1
          setLocal(String(def))
          onChange(def)
        } else {
          onChange(parsed)
        }
      }}
    />
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // <input type="color"> only accepts #rrggbb — strip alpha or use fallback
  const pickerVal = (() => {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
    if (/^#[0-9a-fA-F]{8}$/.test(value)) return value.slice(0, 7)
    if (/^#[0-9a-fA-F]{3}$/.test(value)) return value
    return '#000000'
  })()
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <input type="color" value={pickerVal} onChange={(e) => onChange(e.target.value)}
        style={{ width: 26, height: 24, border: '1px solid #e2e8f0', borderRadius: 3, cursor: 'pointer', padding: 1, background: '#fff' }} />
      <input style={{ ...inp, flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function SelectInput<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]
}) {
  return (
    <select style={inp} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function CheckInput({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1e293b', fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 13, height: 13, accentColor: '#6366f1', cursor: 'pointer' }}
      />
      {label}
    </label>
  )
}

function ImageUploadInput({ onUrl }: { onUrl: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (ev.target?.result) onUrl(ev.target.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*,.gif" hidden onChange={handleFile} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        style={{
          width: '100%', padding: '4px 8px',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 4, cursor: 'pointer',
          fontSize: 9, color: '#6366f1',
          fontFamily: 'IBM Plex Mono, monospace',
        }}
      >
        ↑ Upload image / GIF
      </button>
    </>
  )
}

function Section({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 9, color: '#6366f1', fontFamily: 'IBM Plex Mono, monospace',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      marginTop: 6, paddingBottom: 3,
      borderBottom: '1px solid #e2e8f0',
    }}>
      {title}
    </div>
  )
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      marginTop: 10, width: '100%', padding: '5px 0',
      background: '#fef2f2', border: '1px solid #fecaca',
      borderRadius: 4, color: '#ef4444',
      fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', cursor: 'pointer',
    }}>
      Delete
    </button>
  )
}

// ── Screen config ─────────────────────────────────────────────────────────────

function ScreenConfig({ id }: { id: string }) {
  const nodes = useFlowchartStore(selectNodes)
  const { updateNode, removeNode, setChartRatio } = useFlowchartStore()
  const { setNodes } = useReactFlow()
  const node = nodes.find((n) => n.id === id)
  if (!node || node.type !== 'screen') return null
  const data = node.data as unknown as ScreenData

  function upd(patch: Partial<ScreenData>) { updateNode(id, patch) }
  function changeRatio(ratio: AspectRatio) {
    const dim = ASPECT_RATIO_SIZES[ratio]
    setChartRatio(ratio)
    setNodes((ns) => ns.map((n) => n.type === 'screen'
      ? { ...n, width: dim.w, height: dim.h, style: { ...n.style, width: dim.w, height: dim.h } }
      : n,
    ))
  }

  const ratioOptions = (Object.keys(ASPECT_RATIO_SIZES) as AspectRatio[]).map((r) => ({
    value: r, label: ASPECT_RATIO_SIZES[r].label,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Section title="Screen" />
      <Row label="Label"><TextInput value={data.label} onChange={(v) => upd({ label: v })} /></Row>
      <Row label="Ratio (all screens)"><SelectInput value={data.ratio} onChange={changeRatio} options={ratioOptions} /></Row>
      <Row label="Order"><NumberInput value={data.order} onChange={(v) => upd({ order: v })} min={0} /></Row>
      <Row label="Background"><ColorInput value={data.backgroundColor} onChange={(v) => upd({ backgroundColor: v })} /></Row>
      <Row label="Border"><ColorInput value={data.borderColor} onChange={(v) => upd({ borderColor: v })} /></Row>
      <DeleteBtn onClick={() => removeNode(id)} />
    </div>
  )
}

// ── Element config ────────────────────────────────────────────────────────────

const IN_ANIM_OPTIONS: { value: InAnimationType; label: string }[] = [
  { value: 'none',        label: 'None'        },
  { value: 'fade-in',     label: 'Fade In'     },
  { value: 'slide-up',    label: 'Slide Up'    },
  { value: 'slide-down',  label: 'Slide Down'  },
  { value: 'slide-left',  label: 'Slide Left'  },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'zoom-in',     label: 'Zoom In'     },
  { value: 'bounce',      label: 'Bounce'      },
  { value: 'flip',        label: 'Flip'        },
]

function ElementConfig({ id }: { id: string }) {
  const nodes = useFlowchartStore(selectNodes)
  const { updateNode, updateNodeSize, removeNode, reorderNode, expandElement, drillDown, unlinkExpansion, currentLevel } = useFlowchartStore()
  const { setNodes } = useReactFlow()
  const [showIconPicker, setShowIconPicker] = useState(false)
  const node = nodes.find((n) => n.id === id)
  if (!node || node.type !== 'element') return null
  const data = node.data as unknown as ElementData

  function upd(patch: Partial<ElementData>) { updateNode(id, patch) }
  function updStyle(patch: Partial<ElementData['style']>) { upd({ style: { ...data.style, ...patch } }) }
  function updAnim(patch: Partial<ElementData['animation']>) { upd({ animation: { ...data.animation, ...patch } }) }

  const shadowEnabled = data.style.shadowEnabled ?? false
  const w = node.width  ?? 120
  const h = node.height ?? 50

  function setSize(nw: number, nh: number) {
    updateNodeSize(id, nw, nh)
    setNodes((ns) => ns.map((n) => n.id === id
      ? { ...n, width: nw, height: nh, style: { ...n.style, width: nw, height: nh } }
      : n
    ))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Section title="Element" />
      <Row label="Label"><TextInput value={data.text} onChange={(v) => upd({ text: v })} /></Row>
      <Row label="Step"><NumberInput value={data.step ?? 1} onChange={(v) => upd({ step: Math.max(1, v) })} min={1} allowEmpty fallback={1} /></Row>

      <Section title="Size" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <Row label="W"><NumberInput value={Math.round(w)} onChange={(v) => setSize(Math.max(10, v), h)} min={10} /></Row>
        <Row label="H"><NumberInput value={Math.round(h)} onChange={(v) => setSize(w, Math.max(8, v))} min={8} /></Row>
      </div>

      <Section title="Layer" />
      <Row label="">
        <div style={{ display: 'flex', gap: 2 }}>
          {([
            { dir: 'back',     icon: '⇤', tip: 'Send to back'    },
            { dir: 'backward', icon: '‹', tip: 'Send backward'   },
            { dir: 'forward',  icon: '›', tip: 'Bring forward'   },
            { dir: 'front',    icon: '⇥', tip: 'Bring to front'  },
          ] as const).map(({ dir, icon, tip }) => (
            <button key={dir} title={tip} onClick={() => {
              reorderNode(id, dir)
              setTimeout(() => {
                const st = useFlowchartStore.getState()
                const chartId = st.activeChartId
                if (!chartId) return
                setNodes(st.charts[chartId]?.nodes ?? [])
              }, 0)
            }} style={{
              width: 28, height: 24, padding: 0, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>{icon}</button>
          ))}
        </div>
      </Row>

      {/* Image / GIF URL input */}
      {(data.elementType === 'image' || data.elementType === 'gif') && (
        <>
          <Section title="Image" />
          <Row label="URL / src">
            <TextInput value={data.imageUrl ?? ''} onChange={(v) => upd({ imageUrl: v })} placeholder="https://…" />
          </Row>
          <Row label="Shape clip">
            <SelectInput value={data.shape ?? 'rectangle'} onChange={(v) => upd({ shape: v as any })}
              options={[
                { value: 'rectangle',    label: 'Rectangle'    },
                { value: 'rounded-rect', label: 'Rounded'      },
                { value: 'circle',       label: 'Circle'       },
                { value: 'diamond',      label: 'Diamond'      },
                { value: 'triangle',     label: 'Triangle'     },
              ]}
            />
          </Row>
          <Row label="Fit">
            <SelectInput value={data.imageFit ?? 'cover'} onChange={(v) => upd({ imageFit: v as any })}
              options={[
                { value: 'cover',   label: 'Cover (crop to fill)' },
                { value: 'contain', label: 'Contain (fit inside)' },
                { value: 'fill',    label: 'Stretch to fill'      },
                { value: 'none',    label: 'Original size'        },
              ]}
            />
          </Row>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <Row label="Scale %"><NumberInput value={data.imageScale ?? 100} onChange={(v) => upd({ imageScale: Math.min(100, Math.max(10, v)) })} min={10} max={100} step={5} /></Row>
            <Row label="Radius"><NumberInput value={data.imageRadius ?? 0} onChange={(v) => upd({ imageRadius: Math.max(0, v) })} min={0} max={200} /></Row>
          </div>
          <Row label="Label pos">
            <SelectInput value={data.textPosition ?? 'bottom'} onChange={(v) => upd({ textPosition: v as TextPosition })}
              options={[
                { value: 'top',    label: 'Above image'  },
                { value: 'bottom', label: 'Below image'  },
                { value: 'left',   label: 'Left of image'},
                { value: 'right',  label: 'Right of image'},
                { value: 'center', label: 'Over image'   },
                { value: 'none',   label: 'Hidden'       },
              ]}
            />
          </Row>
          <Row label="">
            <ImageUploadInput onUrl={(url) => upd({ imageUrl: url })} />
          </Row>
        </>
      )}

      {/* Add image overlay to any shape */}
      {data.elementType !== 'premade' && data.elementType !== 'image' && data.elementType !== 'gif' && (
        <>
          <Section title="Image Overlay" />
          <Row label="Image URL">
            <TextInput value={data.imageUrl ?? ''} onChange={(v) => upd({ imageUrl: v })} placeholder="https://… or upload ↓" />
          </Row>
          <Row label="">
            <ImageUploadInput onUrl={(url) => upd({ imageUrl: url })} />
          </Row>
          {data.imageUrl && (
            <>
              <Row label="Fit">
                <SelectInput value={data.imageFit ?? 'cover'} onChange={(v) => upd({ imageFit: v as any })}
                  options={[
                    { value: 'cover',   label: 'Cover (crop to fill)' },
                    { value: 'contain', label: 'Contain (fit inside)' },
                    { value: 'fill',    label: 'Stretch to fill'      },
                    { value: 'none',    label: 'Original size'        },
                  ]}
                />
              </Row>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <Row label="Scale %"><NumberInput value={data.imageScale ?? 100} onChange={(v) => upd({ imageScale: Math.min(100, Math.max(10, v)) })} min={10} max={100} step={5} /></Row>
                <Row label="Radius"><NumberInput value={data.imageRadius ?? 0} onChange={(v) => upd({ imageRadius: Math.max(0, v) })} min={0} max={200} /></Row>
              </div>
              <Row label="Text position">
                <SelectInput value={data.textPosition ?? 'bottom'} onChange={(v) => upd({ textPosition: v as TextPosition })}
                  options={[
                    { value: 'top',    label: 'Above'   },
                    { value: 'bottom', label: 'Below'   },
                    { value: 'left',   label: 'Left'    },
                    { value: 'right',  label: 'Right'   },
                    { value: 'center', label: 'Overlay' },
                    { value: 'none',   label: 'Hidden'  },
                  ]}
                />
              </Row>
            </>
          )}
        </>
      )}

      {/* Premade layout */}
      {data.elementType === 'premade' && (
        <>
          <Section title="Layout" />
          <Row label="Icon position">
            <SelectInput
              value={data.premadeLayout ?? 'top'}
              onChange={(v) => upd({ premadeLayout: v as PremadeLayout })}
              options={[
                { value: 'top',       label: 'Icon top'    },
                { value: 'bottom',    label: 'Icon bottom' },
                { value: 'left',      label: 'Icon left'   },
                { value: 'right',     label: 'Icon right'  },
                { value: 'icon-only', label: 'Icon only'   },
                { value: 'text-only', label: 'Text only'   },
              ]}
            />
          </Row>
          <Row label="Icon size">
            <input
              type="range" min={12} max={120} step={2}
              value={data.premadeIconSize ?? 36}
              onChange={(e) => upd({ premadeIconSize: Number(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: 28, textAlign: 'right', fontSize: 10, color: '#64748b', fontFamily: 'IBM Plex Mono, monospace' }}>
              {data.premadeIconSize ?? 36}
            </span>
          </Row>
        </>
      )}

      {/* Lordicon config */}
      {data.elementType === 'premade' && data.premadeType?.startsWith('lottie-') && (
        <>
          <Section title="Icon" />
          <button
            onClick={() => setShowIconPicker(true)}
            style={{
              width: '100%', padding: '6px 10px', fontSize: 10, cursor: 'pointer',
              borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc',
              color: '#6366f1', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
              transition: 'all .12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = '#6366f1' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}
          >
            Change Icon
          </button>
          <Row label="Primary"><ColorInput value={data.lottiePrimary ?? '#000000'} onChange={(v) => upd({ lottiePrimary: v })} /></Row>
          <Row label="Secondary"><ColorInput value={data.lottieSecondary ?? '#6366f1'} onChange={(v) => upd({ lottieSecondary: v })} /></Row>
          <Section title="Icon Loop" />
          <Row label="Delay (ms)"><NumberInput value={data.lottieDelay ?? 500} onChange={(v) => upd({ lottieDelay: Math.max(0, v) })} min={0} max={10000} step={100} /></Row>
          {showIconPicker && createPortal(
            <div
              style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowIconPicker(false) }}
            >
              <LordinconPickerFlyout
                centered
                anchorTop={0}
                onClose={() => setShowIconPicker(false)}
                onSelect={(iconUrl, name) => {
                  upd({
                    premadeType: `lottie-${name}` as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                    lottieUrl: iconUrl,
                  })
                  setShowIconPicker(false)
                }}
              />
            </div>,
            document.body,
          )}
        </>
      )}

      <Section title="Text" />
      <Row label="Color"><ColorInput value={data.style.textColor} onChange={(v) => updStyle({ textColor: v })} /></Row>
      <Row label="Size"><NumberInput value={data.style.fontSize} onChange={(v) => updStyle({ fontSize: v })} min={6} max={72} /></Row>
      <Row label="Font">
        <SelectInput value={(data.style.fontFamily as string) || 'IBM Plex Sans'} onChange={(v) => updStyle({ fontFamily: v })}
          options={[
            { value: '── Sans-serif ──',      label: '── Sans-serif ──'      },
            { value: 'IBM Plex Sans',          label: 'IBM Plex Sans'          },
            { value: 'Inter',                  label: 'Inter'                  },
            { value: 'Roboto',                 label: 'Roboto'                 },
            { value: 'Open Sans',              label: 'Open Sans'              },
            { value: 'Lato',                   label: 'Lato'                   },
            { value: 'Montserrat',             label: 'Montserrat'             },
            { value: 'Poppins',                label: 'Poppins'                },
            { value: 'Nunito',                 label: 'Nunito'                 },
            { value: 'Raleway',                label: 'Raleway'                },
            { value: 'DM Sans',                label: 'DM Sans'                },
            { value: 'Space Grotesk',          label: 'Space Grotesk'          },
            { value: 'Urbanist',               label: 'Urbanist'               },
            { value: 'Plus Jakarta Sans',      label: 'Plus Jakarta Sans'      },
            { value: 'Outfit',                 label: 'Outfit'                 },
            { value: 'Figtree',                label: 'Figtree'                },
            { value: '── Serif ──',            label: '── Serif ──'            },
            { value: 'Playfair Display',       label: 'Playfair Display'       },
            { value: 'Merriweather',           label: 'Merriweather'           },
            { value: 'Lora',                   label: 'Lora'                   },
            { value: 'EB Garamond',            label: 'EB Garamond'            },
            { value: 'Cormorant Garamond',     label: 'Cormorant Garamond'     },
            { value: '── Monospace ──',        label: '── Monospace ──'        },
            { value: 'IBM Plex Mono',          label: 'IBM Plex Mono'          },
            { value: 'Fira Code',              label: 'Fira Code'              },
            { value: 'JetBrains Mono',         label: 'JetBrains Mono'         },
            { value: 'Source Code Pro',        label: 'Source Code Pro'        },
            { value: '── Display ──',          label: '── Display ──'          },
            { value: 'Bebas Neue',             label: 'Bebas Neue'             },
            { value: 'Oswald',                 label: 'Oswald'                 },
            { value: 'Anton',                  label: 'Anton'                  },
            { value: '── Handwriting ──',      label: '── Handwriting ──'      },
            { value: 'Pacifico',               label: 'Pacifico'               },
            { value: 'Dancing Script',         label: 'Dancing Script'         },
            { value: 'Caveat',                 label: 'Caveat'                 },
          ]}
        />
      </Row>
      <Row label="">
        <div style={{ display: 'flex', gap: 4 }}>
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} onClick={() => updStyle({ textAlign: a })} title={`Align ${a}`} style={{
              flex: 1, padding: '4px 0', fontSize: 12, cursor: 'pointer', borderRadius: 4,
              border: '1px solid #e2e8f0',
              background: (data.style.textAlign ?? 'center') === a ? '#6366f1' : '#f8fafc',
              color:      (data.style.textAlign ?? 'center') === a ? '#fff'    : '#475569',
            }}>
              {a === 'left' ? '≡←' : a === 'center' ? '≡' : '≡→'}
            </button>
          ))}
          <div style={{ width: 1, background: '#e2e8f0', margin: '0 2px' }} />
          {(['top', 'middle', 'bottom'] as const).map((v) => (
            <button key={v} onClick={() => updStyle({ textVerticalAlign: v })} title={`Vertical ${v}`} style={{
              flex: 1, padding: '4px 0', fontSize: 11, cursor: 'pointer', borderRadius: 4,
              border: '1px solid #e2e8f0',
              background: (data.style.textVerticalAlign ?? 'middle') === v ? '#6366f1' : '#f8fafc',
              color:      (data.style.textVerticalAlign ?? 'middle') === v ? '#fff'    : '#475569',
            }}>
              {v === 'top' ? '⬆' : v === 'middle' ? '⬌' : '⬇'}
            </button>
          ))}
          <button onClick={() => updStyle({ fontWeight: data.style.fontWeight === 'bold' ? 'normal' : 'bold' })} title="Bold" style={{
            padding: '4px 9px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
            border: '1px solid #e2e8f0', fontWeight: 'bold',
            background: data.style.fontWeight === 'bold' ? '#6366f1' : '#f8fafc',
            color:      data.style.fontWeight === 'bold' ? '#fff'    : '#475569',
          }}>B</button>
          <button onClick={() => updStyle({ fontStyle: (data.style.fontStyle ?? 'normal') === 'italic' ? 'normal' : 'italic' })} title="Italic" style={{
            padding: '4px 9px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
            border: '1px solid #e2e8f0', fontStyle: 'italic',
            background: (data.style.fontStyle ?? 'normal') === 'italic' ? '#6366f1' : '#f8fafc',
            color:      (data.style.fontStyle ?? 'normal') === 'italic' ? '#fff'    : '#475569',
          }}>I</button>
        </div>
      </Row>

      <Section title="Style" />
      <Row label="Background"><ColorInput value={data.style.backgroundColor} onChange={(v) => updStyle({ backgroundColor: v })} /></Row>
      <Row label="BG Opacity %"><NumberInput value={data.style.backgroundOpacity ?? 100} onChange={(v) => updStyle({ backgroundOpacity: Math.min(100, Math.max(0, v)) })} min={0} max={100} /></Row>
      <Row label="Border Color"><ColorInput value={data.style.borderColor} onChange={(v) => updStyle({ borderColor: v })} /></Row>
      <Row label="Border Width"><NumberInput value={data.style.borderWidth} onChange={(v) => updStyle({ borderWidth: v })} min={0} max={10} /></Row>
      <Row label="Border Radius"><NumberInput value={data.style.borderRadius} onChange={(v) => updStyle({ borderRadius: v })} min={0} max={50} /></Row>
      <Row label="Opacity"><NumberInput value={data.style.opacity} onChange={(v) => updStyle({ opacity: v })} min={0} max={1} step={0.05} /></Row>

      <Section title="Shadow" />
      <Row label="">
        <CheckInput value={shadowEnabled} onChange={(v) => updStyle({ shadowEnabled: v })} label="Enable shadow" />
      </Row>
      {shadowEnabled && (
        <>
          <Row label="Shadow Color"><ColorInput value={data.style.shadowColor ?? '#000000'} onChange={(v) => updStyle({ shadowColor: v })} /></Row>
          <Row label="Opacity %"><NumberInput value={data.style.shadowOpacity ?? 20} onChange={(v) => updStyle({ shadowOpacity: v })} min={0} max={100} /></Row>
          <Row label="Blur"><NumberInput value={data.style.shadowBlur ?? 8} onChange={(v) => updStyle({ shadowBlur: v })} min={0} max={50} /></Row>
          <Row label="Offset X"><NumberInput value={data.style.shadowX ?? 0} onChange={(v) => updStyle({ shadowX: v })} min={-50} max={50} /></Row>
          <Row label="Offset Y"><NumberInput value={data.style.shadowY ?? 2} onChange={(v) => updStyle({ shadowY: v })} min={-50} max={50} /></Row>
        </>
      )}

      <Section title="In Animation" />
      <Row label="Type"><SelectInput value={data.animation.inType} onChange={(v) => updAnim({ inType: v })} options={IN_ANIM_OPTIONS} /></Row>
      <Row label="Duration (s)"><NumberInput value={data.animation.duration} onChange={(v) => updAnim({ duration: v })} min={0.1} step={0.1} /></Row>
      <Row label="Delay (s)"><NumberInput value={data.animation.delay} onChange={(v) => updAnim({ delay: v })} min={0} step={0.1} /></Row>
      <Row label="Stay (s)"><NumberInput value={data.animation.stay ?? 0} onChange={(v) => updAnim({ stay: Math.max(0, v) })} min={0} step={0.5} /></Row>

      <Section title="Levels" />
      {data.expandedScreenId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px' }}>
          <span style={{ fontSize: 9, color: '#22c55e', fontFamily: 'IBM Plex Mono, monospace' }}>
            Expanded to deeper level
          </span>
          <button
            onClick={() => drillDown(id)}
            style={{
              padding: '6px 0', background: '#6366f1', border: 'none', borderRadius: 4,
              color: '#fff', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10, fontWeight: 600,
            }}
          >
            Go to Expanded Screen
          </button>
          <button
            onClick={() => unlinkExpansion(id)}
            style={{
              padding: '5px 0', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4,
              color: '#ef4444', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10, fontWeight: 500,
            }}
          >
            Remove Expansion
          </button>
        </div>
      ) : (
        <div style={{ padding: '0 12px' }}>
          <button
            onClick={() => expandElement(id)}
            style={{
              width: '100%', padding: '6px 0', background: '#eef2ff', border: '1px solid #c7d2fe',
              borderRadius: 4, color: '#6366f1', cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 600,
            }}
          >
            Expand to Level {currentLevel + 1}
          </button>
        </div>
      )}

      <DeleteBtn onClick={() => removeNode(id)} />
    </div>
  )
}

// ── Edge config ───────────────────────────────────────────────────────────────

const EDGE_ANIM_OPTIONS: { value: EdgeAnimationType; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'flow', label: 'Flow' },
  { value: 'pulse', label: 'Pulse' }, { value: 'dash', label: 'Dash' },
]
const EDGE_IN_ANIM_OPTIONS: { value: EdgeInType; label: string }[] = [
  { value: 'none',        label: 'None'   },
  { value: 'fade-in',     label: 'Fade'   },
  { value: 'draw',        label: 'Draw'   },
  { value: 'zoom-in',     label: 'Zoom'   },
  { value: 'slide-left',  label: 'Slide ←'},
  { value: 'slide-right', label: 'Slide →'},
]
const LINE_OPTIONS: { value: EdgeLineType; label: string }[] = [
  { value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' },
]
const ARROW_OPTIONS: { value: EdgeArrowType; label: string }[] = [
  { value: 'filled-arrow', label: 'Filled' }, { value: 'open-arrow', label: 'Open' },
  { value: 'image', label: 'Image' }, { value: 'none', label: 'None' },
]
const PATH_OPTIONS: { value: EdgePathType; label: string }[] = [
  { value: 'bezier', label: 'Bezier' }, { value: 'straight', label: 'Straight' },
  { value: 'step', label: 'Step' }, { value: 'smoothstep', label: 'Smooth Step' },
]
const FLOW_CONTENT_TYPE_OPTIONS: { value: 'none' | 'dot' | 'text' | 'icon'; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'dot', label: 'Dot' }, { value: 'text', label: 'Text' }, { value: 'icon', label: 'Image' },
]

function EdgeConfig({ id }: { id: string }) {
  const edges = useFlowchartStore(selectEdges)
  const { updateEdge, removeEdge } = useFlowchartStore()
  const edge = edges.find((e) => e.id === id)
  const [assets, setAssets] = useState<Array<{ file_id: string; url: string; filename: string }>>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    flowchartAssetsApi.list().then((r) => setAssets(r.data)).catch(() => {})
  }, [])

  async function uploadArrowImage(file: File) {
    setUploading(true)
    try {
      const r = await flowchartAssetsApi.upload(file)
      setAssets((prev) => [...prev, r.data])
      updateEdge(id, { style: { ...(edge?.data as EdgeData)?.style, customArrowUrl: r.data.url } } as Partial<EdgeData>)
    } finally { setUploading(false) }
  }

  async function deleteAsset(fileId: string) {
    await flowchartAssetsApi.delete(fileId)
    setAssets((prev) => prev.filter((a) => a.file_id !== fileId))
    const cur = (edge?.data as EdgeData)?.style?.customArrowUrl
    const asset = assets.find((a) => a.file_id === fileId)
    if (asset && cur === asset.url) updateEdge(id, { style: { ...(edge?.data as EdgeData)?.style, customArrowUrl: undefined } } as Partial<EdgeData>)
  }

  if (!edge || !edge.data) return null
  const data = edge.data as EdgeData

  function updStyle(patch: Partial<EdgeData['style']>) { updateEdge(id, { style: { ...data.style, ...patch } }) }
  function updAnim(patch: Partial<EdgeData['animation']>) { updateEdge(id, { animation: { ...data.animation, ...patch } }) }
  function updFlowContent(patch: Partial<EdgeData['animation']['flowContent']>) {
    const fc = data.animation?.flowContent ?? { type: 'none', text: '', size: 6, color: '#6366f1' }
    updAnim({ flowContent: { ...fc, ...patch } })
  }

  const fc = data.animation?.flowContent ?? { type: 'none', text: '', size: 6, color: '#6366f1' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Section title={`Arrow (${data.edgeKind})`} />
      <Row label="Step"><NumberInput value={data.step ?? 1} onChange={(v) => updateEdge(id, { step: Math.max(1, v) })} min={1} allowEmpty fallback={1} /></Row>
      <Row label="Label"><TextInput value={data.label ?? ''} onChange={(v) => updateEdge(id, { label: v || undefined })} /></Row>

      <Section title="Style" />
      <Row label="Color"><ColorInput value={data.style.color} onChange={(v) => updStyle({ color: v })} /></Row>
      <Row label="Width"><NumberInput value={data.style.strokeWidth} onChange={(v) => updStyle({ strokeWidth: v })} min={1} max={12} /></Row>
      <Row label="Line Type"><SelectInput value={data.style.lineType} onChange={(v) => updStyle({ lineType: v })} options={LINE_OPTIONS} /></Row>
      <Row label="Arrow Head"><SelectInput value={data.style.arrowType} onChange={(v) => updStyle({ arrowType: v as EdgeArrowType })} options={ARROW_OPTIONS} /></Row>
      {data.style.arrowType === 'image' && (
        <div style={{ paddingLeft: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Upload new */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 10, color: '#6366f1', fontFamily: 'IBM Plex Mono, monospace' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArrowImage(f) }} />
            {uploading ? 'Uploading…' : '+ Upload image'}
          </label>
          {/* Gallery of uploaded assets */}
          {assets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {assets.map((a) => (
                <div key={a.file_id} title={a.filename}
                  style={{ position: 'relative', width: 32, height: 32, border: `2px solid ${data.style.customArrowUrl === a.url ? '#6366f1' : '#e2e8f0'}`, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => updStyle({ customArrowUrl: a.url })}
                >
                  <img src={a.url} alt={a.filename} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAsset(a.file_id) }}
                    style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <Row label="Path Type">
        <SelectInput value={data.style.pathType ?? 'bezier'} onChange={(v) => updStyle({ pathType: v })} options={PATH_OPTIONS} />
      </Row>
      <Row label="Marker Size">
        <NumberInput value={data.style.markerSize ?? 6} onChange={(v) => updStyle({ markerSize: v })} min={3} max={20} />
      </Row>
      {(data.style.pathType === 'smoothstep' || data.style.pathType === 'step') && (
        <>
          <Row label="Corner Radius">
            <NumberInput value={data.style.edgeBorderRadius ?? (data.style.pathType === 'smoothstep' ? 10 : 0)} onChange={(v) => updStyle({ edgeBorderRadius: v })} min={0} max={50} />
          </Row>
          {(data.turns?.length ?? 0) > 0 && (
            <Row label="Path">
              <button onClick={() => updateEdge(id, { turns: undefined })} style={{
                padding: '2px 8px', fontSize: 9, cursor: 'pointer', borderRadius: 3,
                border: '1px solid #e2e8f0', background: '#f8fafc', color: '#ef4444',
                fontFamily: 'IBM Plex Mono, monospace',
              }}>Reset path</button>
            </Row>
          )}
        </>
      )}

      <Section title="Appear" />
      <Row label="In Anim"><SelectInput value={(data.animation.inType ?? 'fade-in') as EdgeInType} onChange={(v) => updAnim({ inType: v })} options={EDGE_IN_ANIM_OPTIONS} /></Row>
      <Row label="In Dur (s)"><NumberInput value={data.animation.inDuration ?? 0.4} onChange={(v) => updAnim({ inDuration: v })} min={0.05} step={0.05} /></Row>
      <Row label="Delay (s)"><NumberInput value={data.animation.delay ?? 0} onChange={(v) => updAnim({ delay: v })} min={0} step={0.05} /></Row>
      <Row label="Stay (s)"><NumberInput value={data.animation.stay ?? 0} onChange={(v) => updAnim({ stay: v })} min={0} step={0.05} /></Row>

      <Section title="Loop Animation" />
      <Row label="Type"><SelectInput value={data.animation.type} onChange={(v) => updAnim({ type: v })} options={EDGE_ANIM_OPTIONS} /></Row>
      <Row label="Speed (s)"><NumberInput value={data.animation.duration} onChange={(v) => updAnim({ duration: v })} min={0.1} step={0.1} /></Row>
      <Row label="Loop">
        <SelectInput value={data.animation.loop} onChange={(v) => updAnim({ loop: v })}
          options={[{ value: 'none', label: 'None' }, { value: 'finite', label: 'Finite' }, { value: 'infinite', label: 'Infinite' }]} />
      </Row>
      {data.animation.loop === 'finite' && (
        <Row label="Loop Count"><NumberInput value={data.animation.loopCount} onChange={(v) => updAnim({ loopCount: v })} min={1} /></Row>
      )}

      <Section title="Flow Content" />
      <Row label="Type">
        <SelectInput value={fc.type} onChange={(v) => updFlowContent({ type: v })} options={FLOW_CONTENT_TYPE_OPTIONS} />
      </Row>
      {fc.type !== 'none' && (
        <>
          {fc.type === 'text' && (
            <Row label="Text"><TextInput value={fc.text} onChange={(v) => updFlowContent({ text: v })} /></Row>
          )}
          {fc.type === 'icon' && (
            <Row label="Image URL"><TextInput value={fc.iconUrl ?? ''} onChange={(v) => updFlowContent({ iconUrl: v })} placeholder="https://..." /></Row>
          )}
          {fc.type !== 'icon' && (
            <Row label="Color"><ColorInput value={fc.color} onChange={(v) => updFlowContent({ color: v })} /></Row>
          )}
          <Row label="Size"><NumberInput value={fc.size} onChange={(v) => updFlowContent({ size: v })} min={2} max={48} /></Row>
          <Row label="Speed (s)"><NumberInput value={fc.speed ?? 2} onChange={(v) => updFlowContent({ speed: v })} min={0.1} max={30} step={0.1} /></Row>
          <Row label="Loop Forever">
            <CheckInput value={!!fc.loop} onChange={(v) => updFlowContent({ loop: v })} label="Repeat indefinitely" />
          </Row>
        </>
      )}

      <DeleteBtn onClick={() => removeEdge(id)} />
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 11, color: '#334155', fontFamily: 'IBM Plex Mono, monospace' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: value ? '#6366f1' : '#cbd5e1',
          position: 'relative', transition: 'background .15s',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 2,
          left: value ? 18 : 2,
          transition: 'left .15s',
          boxShadow: '0 1px 3px #00000020',
        }} />
      </button>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export interface GlobalConfig {
  snapEnabled: boolean
  setSnapEnabled: (v: boolean) => void
  stepBadges: boolean
  setStepBadges: (v: boolean) => void
  autoSave: boolean
  setAutoSave: (v: boolean) => void
  showDebug: boolean
  setShowDebug: (v: boolean) => void
  onGenerate: () => void
}

export const ConfigPanel = memo(({ global }: { global: GlobalConfig }) => {
  const nodes = useFlowchartStore(selectNodes)
  const { selectedNodeId, selectedEdgeId } = useFlowchartStore()

  if (!selectedNodeId && !selectedEdgeId) {
    return (
      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Canvas Settings
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ToggleRow label="Snap to Grid" value={global.snapEnabled} onChange={global.setSnapEnabled} />
            <ToggleRow label="Step Numbers" value={global.stepBadges} onChange={global.setStepBadges} />
            <ToggleRow label="Auto Save" value={global.autoSave} onChange={global.setAutoSave} />
            <ToggleRow label="Debug Info" value={global.showDebug} onChange={global.setShowDebug} />
          </div>
        </div>
        <button
          onClick={global.onGenerate}
          style={{
            padding: '8px 14px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
            fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
            border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
            transition: 'all .15s',
            width: '100%',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(99,102,241,0.5)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(99,102,241,0.35)' }}
        >
          ✦ AI Generate
        </button>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center', lineHeight: 1.6 }}>
          Select a screen, element, or edge to edit its properties.
        </span>
      </div>
    )
  }

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null

  return (
    <div style={{ padding: '10px 14px', overflowY: 'auto', height: '100%' }}>
      {selectedNodeId && selectedNode?.type === 'screen'  && <ScreenConfig  id={selectedNodeId} />}
      {selectedNodeId && selectedNode?.type === 'element' && <ElementConfig id={selectedNodeId} />}
      {selectedEdgeId  && <EdgeConfig id={selectedEdgeId} />}
    </div>
  )
})

ConfigPanel.displayName = 'ConfigPanel'
