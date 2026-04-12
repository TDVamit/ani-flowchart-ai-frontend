// ── Aspect ratios ────────────────────────────────────────────────────────────

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'

export const ASPECT_RATIO_SIZES: Record<AspectRatio, { w: number; h: number; label: string }> = {
  '16:9':  { w: 534, h: 300, label: '16:9  Landscape'  },
  '9:16':  { w: 169, h: 300, label: '9:16  Portrait'   },
  '1:1':   { w: 300, h: 300, label: '1:1   Square'     },
  '4:3':   { w: 400, h: 300, label: '4:3   Standard'   },
  '3:4':   { w: 225, h: 300, label: '3:4   Portrait'   },
  '21:9':  { w: 700, h: 300, label: '21:9  Ultrawide'  },
}

// ── Shapes / premade ─────────────────────────────────────────────────────────

export type ShapeType =
  | 'rectangle' | 'rounded-rect' | 'circle' | 'diamond'
  | 'parallelogram' | 'cylinder' | 'hexagon' | 'document'
  | 'triangle' | 'star' | 'cross' | 'arrow-right' | 'cloud' | 'tag'

export type PremadeType =
  | 'processing' | 'building' | 'writing' | 'loading'
  | 'checking' | 'sending' | 'thinking' | 'uploading'
  | 'success' | 'error' | 'warning' | 'waiting'
  | 'syncing' | 'downloading' | 'scanning' | 'typing'
  | 'broadcasting' | 'recording' | 'streaming' | 'connecting'
  | 'api' | 'database' | 'server' | 'user' | 'clock'
  | 'sparkle' | 'fire' | 'shield' | 'lock' | 'refresh'
  | `lucide-${string}`
  | `lottie-${string}`

export const PREMADE_LABELS: Record<string, string> = {
  processing:   'Processing',
  building:     'Building',
  writing:      'Writing',
  loading:      'Loading',
  checking:     'Checking',
  sending:      'Sending',
  thinking:     'Thinking',
  uploading:    'Uploading',
  success:      'Success',
  error:        'Error',
  warning:      'Warning',
  waiting:      'Waiting',
  syncing:      'Syncing',
  downloading:  'Downloading',
  scanning:     'Scanning',
  typing:       'Typing',
  broadcasting: 'Broadcasting',
  recording:    'Recording',
  streaming:    'Streaming',
  connecting:   'Connecting',
  api:          'API Call',
  database:     'Database',
  server:       'Server',
  user:         'User',
  clock:        'Clock',
  sparkle:      'Sparkle',
  fire:         'Fire',
  shield:       'Shield',
  lock:         'Lock',
  refresh:      'Refresh',
}

// ── Animation types ───────────────────────────────────────────────────────────

export type InAnimationType =
  | 'none' | 'fade-in' | 'slide-up' | 'slide-down'
  | 'slide-left' | 'slide-right' | 'zoom-in' | 'bounce' | 'flip'

export type EdgeAnimationType = 'none' | 'flow' | 'pulse' | 'dash'
export type EdgeInType       = InAnimationType | 'draw'
export type EdgeLineType    = 'solid' | 'dashed' | 'dotted'
export type EdgeArrowType   = 'filled-arrow' | 'open-arrow' | 'none' | 'image'
export type EdgeKind        = 'element' | 'screen' | 'cross-screen'
export type EdgePathType    = 'bezier' | 'straight' | 'step' | 'smoothstep'

// ── Node data ─────────────────────────────────────────────────────────────────

export interface ScreenData {
  label: string
  ratio: AspectRatio
  backgroundColor: string
  borderColor: string
  order: number       // playback order
}

export interface ElementStyle {
  backgroundColor: string
  backgroundOpacity: number  // 0–100, only affects background color
  borderColor: string
  borderWidth: number
  borderRadius: number
  textColor: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right'
  textVerticalAlign: 'top' | 'middle' | 'bottom'
  fontFamily: string
  opacity: number
  // Shadow
  shadowEnabled: boolean
  shadowColor: string
  shadowOpacity: number  // 0–100
  shadowBlur: number
  shadowX: number
  shadowY: number
}

export interface ElementAnimation {
  inType: InAnimationType
  duration: number  // seconds — how long the in-animation takes
  delay: number     // seconds — delay before in-animation starts
  stay: number      // seconds — how long to hold after animation before next step
}

export type PremadeLayout  = 'top' | 'bottom' | 'left' | 'right' | 'icon-only' | 'text-only'
export type TextPosition   = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'none'

export interface ElementData {
  elementType: 'shape' | 'text' | 'image' | 'gif' | 'premade'
  shape?: ShapeType
  premadeType?: PremadeType
  text: string
  imageUrl?: string
  imageFit?: 'cover' | 'contain' | 'fill' | 'none'  // CSS object-fit for image elements
  imageScale?: number    // 10–100 — percentage of element area the image fills (default 100)
  imageRadius?: number   // border-radius in px on the image itself (default 0)
  lottieUrl?: string              // CDN JSON URL for lord-icon elements
  lottiePrimary?: string          // lord-icon primary color (default #ffffff)
  lottieSecondary?: string        // lord-icon secondary color (default #6366f1)
  lottieDelay?: number            // lord-icon loop delay in ms (default 500)
  premadeLayout?: PremadeLayout   // icon+label arrangement for premade elements
  premadeIconSize?: number        // explicit icon/SVG size in px (overrides auto formula)
  textPosition?: TextPosition     // label position when element has an image
  style: ElementStyle
  animation: ElementAnimation
  step: number  // 1-based appearance order
}

// ── Edge data ─────────────────────────────────────────────────────────────────

export interface EdgeStyle {
  color: string
  strokeWidth: number
  lineType: EdgeLineType
  arrowType: EdgeArrowType
  customArrowUrl?: string   // URL for custom image arrowhead (arrowType='image')
  pathType: EdgePathType
  markerSize: number
  edgeBorderRadius?: number // corner radius for smoothstep paths (default 10)
}

export interface FlowContent {
  type: 'none' | 'dot' | 'text' | 'icon'
  text: string
  size: number
  color: string
  iconUrl?: string   // URL for custom icon/image
  loop?: boolean     // if true, animateMotion repeats indefinitely (overrides edge loop setting)
  speed?: number     // duration in seconds for one traversal (lower = faster). Default 2
}

export interface EdgeAnimation {
  type:       EdgeAnimationType
  loop:       'none' | 'finite' | 'infinite'
  loopCount:  number
  duration:   number          // flowContent / loop animation speed
  flowContent: FlowContent
  inType:     EdgeInType      // how the edge appears
  inDuration: number          // in-animation duration (s)
  delay:      number          // delay before in-animation (s)
  stay:       number          // hold after in-animation before next step
}

export interface EdgeData {
  edgeKind: EdgeKind
  style: EdgeStyle
  animation: EdgeAnimation
  label?: string
  step?: number   // appearance order in animation
  pathOffset?: { x: number; y: number }  // legacy single-handle midpoint for step/smoothstep
  turns?: Array<{ x: number; y: number }>  // absolute turn-point coords for step/smoothstep segment control
}

// ── Default factories ─────────────────────────────────────────────────────────

export const defaultElementStyle = (): ElementStyle => ({
  backgroundColor: '#ffffff',
  backgroundOpacity: 100,
  borderColor: '#6366f1',
  borderWidth: 1.5,
  borderRadius: 4,
  textColor: '#1e293b',
  fontSize: 13,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'center',
  textVerticalAlign: 'middle',
  fontFamily: 'IBM Plex Sans',
  opacity: 1,
  shadowEnabled: false,
  shadowColor: '#000000',
  shadowOpacity: 20,
  shadowBlur: 8,
  shadowX: 0,
  shadowY: 2,
})

export const defaultElementAnimation = (): ElementAnimation => ({
  inType: 'fade-in',
  duration: 0.4,
  delay: 0,
  stay: 0,
})

export const defaultEdgeStyle = (): EdgeStyle => ({
  color: '#6366f1',
  strokeWidth: 2,
  lineType: 'solid',
  arrowType: 'filled-arrow',
  pathType: 'bezier',
  markerSize: 6,
})

export const defaultFlowContent = (): FlowContent => ({
  type: 'none',
  text: '',
  size: 6,
  color: '#6366f1',
  loop: true,   // default: loop forever
  speed: 2,     // 2 seconds per traversal
})

export const defaultEdgeAnimation = (): EdgeAnimation => ({
  type:        'none',
  loop:        'none',
  loopCount:   1,
  duration:    1,
  flowContent: defaultFlowContent(),
  inType:      'fade-in',
  inDuration:  0.4,
  delay:       0,
  stay:        0,
})
