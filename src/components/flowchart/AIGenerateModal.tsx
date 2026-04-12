import { memo, useState, useRef, useEffect } from 'react'
import { flowchartAiApi } from '../../api/client'
import { useFlowchartStore } from '../../store/useFlowchartStore'

const EXAMPLES = [
  'User registration and email verification flow',
  'API request lifecycle with error handling',
  'E-commerce checkout process',
  'CI/CD pipeline from commit to deploy',
  'Customer support ticket escalation',
  'OAuth2 login with social providers',
]

type Step = 'idle' | 'fetching-icons' | 'generating' | 'importing' | 'done' | 'error'

const STEP_LABELS: Record<Step, string> = {
  'idle':          '',
  'fetching-icons':'Fetching icon library…',
  'generating':    'Generating flowchart with AI…',
  'importing':     'Building chart…',
  'done':          'Done!',
  'error':         '',
}

export const AIGenerateModal = memo(({ onClose }: { onClose: () => void }) => {
  const [prompt, setPrompt]   = useState('')
  const [ratio, setRatio]     = useState('16:9')
  const [step, setStep]       = useState<Step>('idle')
  const [error, setError]     = useState('')
  const textareaRef           = useRef<HTMLTextAreaElement>(null)
  const { importAIChart }     = useFlowchartStore()

  useEffect(() => {
    textareaRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleGenerate() {
    if (!prompt.trim() || (step !== 'idle' && step !== 'error')) return
    setError('')
    setStep('fetching-icons')

    try {
      // Backend fetches icons internally; we just show the label for UX
      await new Promise((r) => setTimeout(r, 600))
      setStep('generating')

      const res = await flowchartAiApi.generate(prompt.trim(), ratio)

      setStep('importing')
      await new Promise((r) => setTimeout(r, 300))

      importAIChart(res.data)
      setStep('done')
      setTimeout(onClose, 800)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as { message?: string })?.message ?? 'Generation failed'
      setError(msg)
      setStep('error')
    }
  }

  const busy = step !== 'idle' && step !== 'error'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
        width: 560,
        maxWidth: 'calc(100vw - 32px)',
        padding: '28px 28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>✦</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Generate Flowchart with AI
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', fontFamily: 'IBM Plex Mono, monospace' }}>
              Describe your process — AI builds screens, elements, animations, and connections.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: 18, padding: '2px 6px', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Prompt */}
        <div>
          <label style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
            Describe your flowchart
          </label>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
            }}
            placeholder="e.g. User login with OAuth, email verification, and session management across 3 screens…"
            rows={4}
            disabled={busy}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px',
              border: '1px solid #e2e8f0', borderRadius: 8,
              fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', color: '#1e293b',
              resize: 'vertical', outline: 'none',
              background: busy ? '#f8fafc' : '#ffffff',
              lineHeight: 1.6,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#6366f1' }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = '#e2e8f0' }}
          />
        </div>

        {/* Example prompts */}
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Examples
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setPrompt(ex); textareaRef.current?.focus() }}
                disabled={busy}
                style={{
                  padding: '4px 10px',
                  background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 20,
                  fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: '#475569',
                  cursor: 'pointer', transition: 'all .1s',
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.background   = '#eef2ff'
                  b.style.borderColor  = '#6366f1'
                  b.style.color        = '#6366f1'
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.background   = '#f1f5f9'
                  b.style.borderColor  = '#e2e8f0'
                  b.style.color        = '#475569'
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Options row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
            Screen ratio
          </label>
          {(['16:9', '1:1', '9:16', '4:3'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRatio(r)}
              disabled={busy}
              style={{
                padding: '3px 10px',
                background: ratio === r ? '#6366f1' : '#f8fafc',
                border: `1px solid ${ratio === r ? '#6366f1' : '#e2e8f0'}`,
                borderRadius: 4, cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
                color: ratio === r ? '#fff' : '#64748b',
                transition: 'all .1s',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Status / error */}
        {(busy || (step as Step) === 'done') && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            background: step === 'done' ? '#f0fdf4' : '#eef2ff',
            border: `1px solid ${step === 'done' ? '#86efac' : '#c7d2fe'}`,
            borderRadius: 8,
          }}>
            {step !== 'done' && (
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <circle cx={8} cy={8} r={6} stroke="#6366f1" strokeWidth={2} strokeDasharray="20 10"
                  style={{ animation: 'spin 1s linear infinite', transformOrigin: '8px 8px' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </svg>
            )}
            {step === 'done' && <span style={{ color: '#22c55e' }}>✓</span>}
            <span style={{
              fontSize: 12, fontFamily: 'IBM Plex Mono, monospace',
              color: step === 'done' ? '#15803d' : '#6366f1',
            }}>
              {STEP_LABELS[step]}
            </span>
          </div>
        )}

        {step === 'error' && error && (
          <div style={{
            padding: '10px 14px',
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
            fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7,
              fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748b',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || busy}
            style={{
              padding: '8px 22px',
              background: !prompt.trim() || busy ? '#e0e7ff' : 'linear-gradient(135deg, #6366f1, #818cf8)',
              border: 'none', borderRadius: 7,
              fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#ffffff',
              cursor: !prompt.trim() || busy ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              boxShadow: !prompt.trim() || busy ? 'none' : '0 2px 8px rgba(99,102,241,0.4)',
              transition: 'all .15s',
            }}
          >
            {busy ? 'Generating…' : '✦ Generate  ⌘↵'}
          </button>
        </div>
      </div>
    </div>
  )
})

AIGenerateModal.displayName = 'AIGenerateModal'
